from flask import Flask, request, render_template, url_for, jsonify, redirect, send_from_directory, Response, stream_with_context
import os
from werkzeug.utils import secure_filename
from tools_repo import create_Vector, start_generation
import threading
import time
import uuid


os.environ['KMP_DUPLICATE_LIB_OK']='True'

app = Flask(__name__)
# app.config['UPLOAD_FOLDER'] = 'uploads'
# app.config['PROCESSED_FOLDER'] = 'processed'


# # Ensure the upload and processed folders exist
# os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
# os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

tasks = {}
progress_updates = {}

ALLOWED_EXTENSIONS = {'pdf', 'docx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        report_type = request.form.get('report-type')
        report_template = request.files.get('report-template')
        raw_file = request.files.get('raw-file')
        
        if not report_type or not report_template or not raw_file:
            return 'Form not completely filled out', 400
        
        if not (allowed_file(report_template.filename) and allowed_file(raw_file.filename)):
            return 'Invalid file type. Only PDF and DOCX files are allowed.', 400
        
        generated_uuid = uuid.uuid4()
        parent_fold = f'Main_Folder_{generated_uuid}'

        app.config['UPLOAD_FOLDER'] = os.path.join(parent_fold, 'uploads')
        app.config['PROCESSED_FOLDER'] = os.path.join(parent_fold, 'processed')

        os.makedirs(os.path.join(app.config['UPLOAD_FOLDER']), exist_ok=True)
        os.makedirs(os.path.join(app.config['PROCESSED_FOLDER']), exist_ok=True)
        
        report_template_filename = os.path.join(app.config['UPLOAD_FOLDER'], report_template.filename)
        raw_file_filename = os.path.join(app.config['UPLOAD_FOLDER'], raw_file.filename)

        report_template.save(report_template_filename)
        raw_file.save(raw_file_filename)

        #call test_pdf to create vector_db
        #removed create_Vector method for now to test OCR implementation
        #create_Vector(raw_file_filename)
        #raw_file_filename = request.form['raw_file']
        # thread = threading.Thread(target=create_Vector, args=(raw_file_filename,))
        # thread.start()


        #process the data in a different thread
        task_id = str(len(tasks) + 1)
        tasks[task_id] = {'status': 'PENDING', 'processed_filepath': ''}
        progress_updates[task_id] = []
        threading.Thread(target=process_pdf, args=(report_type, report_template_filename, task_id, raw_file_filename, parent_fold)).start()
        return redirect(url_for('loading', task_id=task_id))

    return render_template('index.html')


@app.route('/loading/<task_id>')
def loading(task_id):
    return render_template('loading.html', task_id=task_id)

@app.route('/status/<task_id>')
def task_status(task_id):
    status = tasks.get(task_id, {}).get('status', 'NOT_FOUND')
    return jsonify({'status': status})

@app.route('/complete/<task_id>')
def complete(task_id):
    processed_filepath = tasks.get(task_id, {}).get('processed_filepath')
    if processed_filepath:
        return render_template('complete.html', task_id=task_id, filename=os.path.basename(processed_filepath))
    else:
        return 'File not found', 404

@app.route('/download/<task_id>/<filename>')
def download(task_id, filename):
    processed_filepath = tasks.get(task_id, {}).get('processed_filepath')
    if processed_filepath and os.path.basename(processed_filepath) == filename:
        directory = os.path.dirname(processed_filepath)
        return send_from_directory(directory, filename, as_attachment=True)
    else:
        return 'File not found', 404

@app.route('/progress/<task_id>')
def progress(task_id):
    def generate():
        while True:
            if task_id in progress_updates:
                while progress_updates[task_id]:
                    update = progress_updates[task_id].pop(0)
                    yield f"data: {update}\n\n"
            if tasks[task_id]['status'] == 'COMPLETED':
                yield f"data: COMPLETED\n\n"
                break
            time.sleep(1)

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

def update_progress(task_id, message):
    if task_id in progress_updates:
        progress_updates[task_id].append(message)

def process_pdf(report_type, report_template_filename, task_id, filepath, parent_fold):
    processed_filepath = start_generation(report_type, report_template_filename, lambda message: update_progress(task_id, message), filepath, parent_fold)
    tasks[task_id] = {'status': 'COMPLETED', 'processed_filepath': processed_filepath}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
