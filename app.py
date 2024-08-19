from flask import Flask, render_template, request, jsonify, redirect, url_for, send_file, send_from_directory, Response, stream_with_context
from flask_dropzone import Dropzone
from werkzeug.utils import secure_filename
from datetime import datetime
import threading
import time
import uuid
import os

from utils import classify_filename
from ai_service import *                                                      
os.environ['KMP_DUPLICATE_LIB_OK']='True'                                                                                                          
app = Flask(__name__)
dropzone = Dropzone(app)

# Configure Flask-Dropzone
app.config['DROPZONE_UPLOAD_MULTIPLE'] = True
app.config['DROPZONE_ALLOWED_FILE_CUSTOM'] = True
app.config['DROPZONE_ALLOWED_FILE_TYPE'] = 'image/*, .pdf, .docx'
app.config['DROPZONE_MAX_FILE_SIZE'] = 3
app.config['DROPZONE_IN_FORM'] = True
app.config['DROPZONE_UPLOAD_ON_CLICK'] = True
app.config['DROPZONE_PARALLEL_UPLOADS'] = 3

# Configure upload and report folder
UPLOAD_FOLDER = 'uploads'
REPORT_FOLDER = 'reports'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(REPORT_FOLDER):
    os.makedirs(REPORT_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['REPORT_FOLDER'] = REPORT_FOLDER

# Document Classes
document_classes = ["LOI", "IME Report", "Report Template"]

# Initialize variables
doc_loi = None
doc_ime_report = []
doc_report_template = None
    
# Store file metadata in a global variable for simplicity
file_metadata = []

tasks = {}
progress_updates = {}

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html', dropzone=dropzone)

@app.route('/upload', methods=['POST'])
def upload():
    global file_metadata
    file = request.files.getlist('file')[0]
    if not allowed_file(file.filename):
        return 'Invalid file type. Only PDF and DOCX files are allowed.', 400        
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(file_path)

    return jsonify({'message': 'Files successfully uploaded', 'file': file_path})

@app.route('/generate_report', methods=['POST'])
def generate_report():
    global doc_ime_report, doc_loi, doc_report_template
    data = request.get_json()
    selected_files = data.get('files', [])
    print("Selected Files for Report:", selected_files)
    
    if len(selected_files) > 2:
        classified_files = {name: classify_filename(name, document_classes) for name in selected_files}
        
        selected_loi = []
        selected_report_template = []
        selected_ime_reports = []
    
        # Extract the files based on their classification
        for filename, category in classified_files.items():
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if category == 'LOI':
                selected_loi.append(file_path)
            elif category == 'IME Report':
                selected_ime_reports.append(file_path)
            elif category == 'Report Template':
                selected_report_template.append(file_path)
        
        # Check if multiple LOIs or Report Templates are selected
        if len(selected_loi) > 1 or len(selected_report_template) > 1:
            return jsonify({'message': 'Please select only one LOI document or Report Template.', 'report_path': None})

        # Ensure that one LOI, one Report Template, and at least one IME Report are selected
        if len(selected_loi) == 1 and len(selected_report_template) == 1 and len(selected_ime_reports) > 0:
            generated_report_path = generate_final_report(
                selected_loi[0],
                selected_ime_reports,
                selected_report_template[0],
                app.config['REPORT_FOLDER']
            )
            return jsonify({'message': 'Report generated successfully', 'report_path': generated_report_path})
        
        # if all([selected_loi[0] is not None, doc_report_template is not None, len(doc_ime_report) != 0]):            
        #     generated_report_path = generate_final_report(doc_loi, doc_ime_report, doc_report_template, app.config['REPORT_FOLDER'])
        #     return jsonify({'message': 'Report generated successfully', 'report_path': generated_report_path})
        else:
            return jsonify({'message': 'Please check your documents again.', 'report_path': None})
    else:
        return jsonify({'message': 'Please check your documents again.', 'report_path': None})

@app.route('/download_report', methods=['GET'])
def download_report():
    report_path = request.args.get('report_path')
    return send_file(report_path, as_attachment=True)

@app.route('/reset', methods=['POST'])
def reset():
    global file_metadata
    file_metadata = []
    for file in os.listdir(app.config['UPLOAD_FOLDER']):
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file)
        if os.path.isfile(file_path):
            os.remove(file_path)
    return jsonify({'message': 'Application reset successfully'})

@app.route('/delete_file', methods=['POST'])
def delete_file():
    filename = request.form['filename']
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return jsonify({'message': f'{filename} deleted successfully'})
    return jsonify({'message': f'{filename} not found'}), 404

@app.route('/edit_file', methods=['POST'])
def edit_file():
    old_filename = request.form['old_filename']
    new_filename = request.form['new_filename']
    old_file_path = os.path.join(app.config['UPLOAD_FOLDER'], old_filename)
    new_file_path = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
    if os.path.exists(old_file_path):
        os.rename(old_file_path, new_file_path)
        return jsonify({'message': f'{old_filename} renamed to {new_filename}'})
    return jsonify({'message': f'{old_filename} not found'}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5001)