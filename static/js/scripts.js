let originalFileItems = [];

document.addEventListener('DOMContentLoaded', function() {
    // Store the original list items when the page loads
    originalFileItems = Array.from(document.querySelectorAll('#fileList li'));

    const selectAllContainer = document.getElementById('selectAllContainer');
    // Hide the selectAllContainer initially
    selectAllContainer.style.display = 'none';
});

document.getElementById('searchInput').addEventListener('input', function() {
    const query = this.value.toLowerCase();

    // Clear the current file list
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    // Filter and display the items based on the search query
    originalFileItems.forEach(item => {
        const filenameElement = item.querySelector('.filename');
        if (filenameElement) {
            const filename = filenameElement.textContent.toLowerCase();
            if (filename.includes(query)) {
                fileList.appendChild(item); // Add matching items back to the list
            }
        }
    });
});

document.getElementById('selectAllCheckbox').addEventListener('change', function() {    
    const fileList = document.getElementById('fileList');
    const checkboxes = fileList.querySelectorAll('.include-in-process');
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
});

document.getElementById('fileList').addEventListener('change', function () {
    const checkboxes = fileList.querySelectorAll('.include-in-process');
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
    selectAllCheckbox.checked = allChecked;
    updateSelectAllVisibility();
});

function updateSelectAllVisibility() {
    const selectAllContainer = document.getElementById('selectAllContainer');
    const fileList = document.getElementById('fileList');

    if (fileList.children.length > 0) {
        selectAllContainer.style.display = 'flex'; // Show with the original flex style
    } else {
        selectAllContainer.style.display = 'none';
    }
}

function handleDelete(event) {
    const listItem = event.currentTarget.closest('li');
    const filename = listItem.querySelector('.filename').textContent;    
    deleteFile(filename, listItem);
}

function handleEdit(event) {
    const listItem = event.currentTarget.closest('li');
    const filename = listItem.querySelector('.filename').textContent;    
    editFile(filename, listItem);
}

function updateFileList(file) {
    const fileList = document.getElementById('fileList');
    //fileList.innerHTML = '';  // Clear existing list
    const template = document.getElementById('fileItemTemplate').content;
    //console.log("FILE INFO:", file)
    const clone = document.importNode(template, true);
    clone.querySelector('.filename').textContent = file.name;
    clone.querySelector('.file-size').textContent = `${(file.size / 1024).toFixed(2)} KB`;
    clone.querySelector('.date-uploaded').textContent = getFormattedDate(new Date());
    clone.querySelector('.last-updated').textContent = getFormattedDate(file.lastModifiedDate);

    const listItem = clone.querySelector('li');

    clone.querySelector('.delete-button').addEventListener('click', handleDelete);
    clone.querySelector('.edit-button').addEventListener('click', handleEdit);
    fileList.appendChild(listItem);
    originalFileItems.push(listItem);
}

function getFormattedDate(dateString) {
    // Create a Date object from the string
    const date = new Date(dateString);

    // Extract the month, day, and year
    const month = date.getMonth() + 1; // Months are zero-indexed, so add 1
    const day = date.getDate();
    const year = date.getFullYear();

    // Format the date as "7/10/2024"
    const formattedDate = `${month}/${day}/${year}`;

    return formattedDate
}

function deleteFile(filename, listItem) {    
    const formData = new FormData();
    formData.append('filename', filename);

    fetch('/delete_file', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            if (data.message.includes('deleted successfully')) {
                // Remove from the DOM
                listItem.remove();
                // Remove from originalFileItems
                originalFileItems = originalFileItems.filter(item => item !== listItem);
                showToast(data.message);
            }
        })
        .catch(error => {
            showToast('Error deleting file: ' + error); // Show error message
            console.error('Error deleting file:', error);
        });
}

function editFile(filename, listItem) {
    const newFilename = prompt('Enter new filename:', filename);
    if (newFilename && newFilename !== filename) {
        const formData = new FormData();
        formData.append('old_filename', filename);
        formData.append('new_filename', newFilename);

        fetch('/edit_file', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                listItem.querySelector('.filename').textContent = newFilename; 
                showToast(data.message); // Show success message
            })
            .catch(error => {
                showToast('Error renaming file: ' + error); // Show error message
                console.error('Error renaming file:', error);
            });
    }
}

function displayDownloadButton(reportPath) {
    const downloadButtonContainer = document.getElementById('downloadButtonContainer');
    downloadButtonContainer.innerHTML = '';  // Clear existing button
    const downloadButton = document.createElement('button');
    downloadButton.id = 'downloadButton';
    downloadButton.innerHTML = `<i class="fas fa-download"></i> Download`;
    //downloadButton.textContent = `Download ${reportPath.split('/').pop()}`;
    //downloadButton.textContent = `Download`;
    downloadButton.addEventListener('click', () => {
        window.location.href = `/download_report?report_path=${reportPath}`;
    });
    downloadButtonContainer.style.display = 'block';
    downloadButtonContainer.appendChild(downloadButton);
}

function showSpinner() {
    document.getElementById('spinnerOverlay').style.display = 'flex';
    document.getElementById('aiProcessingMessage').style.display = 'block'; // Show the AI processing message
}

function hideSpinner() {
    document.getElementById('spinnerOverlay').style.display = 'none';
    document.getElementById('aiProcessingMessage').style.display = 'none'; // Hide the AI processing message
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000); // Hide after 3 seconds
}

function clearFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = ''; // Clear all the list items
    originalFileItems = []
    updateSelectAllVisibility();
}

function showToast(message) {
    const toastContainer = document.getElementById('toastContainer');

    // Create a new toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    // Append the toast to the container
    toastContainer.appendChild(toast);

    // Show the toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100); // Timeout to trigger the animation

    // Hide and remove the toast after 3 seconds
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            toast.remove();
        }, 500); // Allow time for the hide animation
    }, 3000);
}

document.getElementById('generateReportButton').addEventListener('click', function () {
    const generateButton = this;
    generateButton.disabled = true;
    const fileList = originalFileItems.map(item => item.querySelector('.filename').textContent);    

    const includedFiles = [];
    document.querySelectorAll('.include-in-process:checked').forEach(checkbox => {
        const listItem = checkbox.closest('li');
        const filename = listItem.querySelector('.filename').textContent;
        if (fileList.includes(filename)) {
            includedFiles.push(filename);
        }        
    });

    if (includedFiles.length > 2 ) {
        showSpinner();
        fetch('/generate_report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ files: includedFiles })
        })
            .then(response => response.json())
            .then(data => {
                generateButton.disabled = false; 
                hideSpinner(); // Hide spinner when the report is ready
                showToast(data.message); // Show toast notification for success or failure
                if (data.report_path) {
                    displayDownloadButton(data.report_path);                    
                }
            })
            .catch(error => {
                hideSpinner(); // Hide spinner if an error occurs
                showToast('Error generating report: ' + error); // Show toast notification for error
                console.error('Error generating report:', error);
                generateButton.disabled = false; // Re-enable the button if there is an error
            });
    }

    else {
        generateButton.disabled = false; 
        showToast("Please upload or select all the documents you will use.");
    }


});

document.getElementById('resetButton').addEventListener('click', function () {
    fetch('/reset', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            clearFileList();
            const downloadButtonContainer = document.getElementById('downloadButtonContainer');
            downloadButtonContainer.innerHTML = '';  // Clear existing button
            const selectAllCheckbox = document.getElementById('selectAllCheckbox');
            selectAllCheckbox.checked = false;
            // Re-enable the "Generate Report" button
            const generateButton = document.getElementById('generateReportButton');
            generateButton.disabled = false;
        });
});

// document.getElementById('searchButton').addEventListener('click', function() {
//     const query = document.getElementById('searchInput').value.toLowerCase();
//     const fileItems = document.querySelectorAll('#fileList li');

//     fileItems.forEach(item => {
//         const filenameElement = item.querySelector('.filename');
//         if (filenameElement) {
//             const filename = filenameElement.textContent.toLowerCase();
//             if (filename.includes(query)) {
//                 item.style.display = ''; // Show item if it matches the query
//             } else {
//                 item.style.display = 'none'; // Hide item if it doesn't match the query
//             }
//         }
//     });
// });

Dropzone.options.myAwesomeDropzone = {
    acceptedFiles: '.pdf, .doc, .docx',
    previewsContainer: false, // Disable the default preview container
    createImageThumbnails: false, // Disable image thumbnails
    addRemoveLinks: false, // Disable the "Remove file" link
    autoProcessQueue: true, // Automatically process the queue
    clickable: true, // Enable the click to open file dialog
    dictDefaultMessage: `<div class="icon"><i class="fas fa-cloud-upload-alt fa-3x"></i></div><div>Click to upload or drag and drop</div>`,
    init: function () {
        this.on("addedfile", function (file) {
            //updateSelectAllVisibility();
            const fileList = originalFileItems.map(item => item.querySelector('.filename').textContent.toLowerCase());
            
            // Check if the file extension is allowed
            if (!this.options.acceptedFiles.includes(file.name.split('.')[1]) && !this.options.acceptedFiles.split(',').includes('.' + file.name.split('.').pop().toLowerCase())) {
                this.removeFile(file); // Remove the file from Dropzone queue
                showToast('File type not allowed: ' + file.name);
            }

            else if (fileList.includes(file.name.toLowerCase())) {
                // If the file already exists, remove it from the Dropzone queue
                this.removeFile(file);
                showToast('File already exists: ' + file.name);
            } else {
                // If the file is new, add it to the list and originalFileItems array
                updateFileList(file);
                updateSelectAllVisibility();                
            }
        });
        
    }   
};

document.getElementById('resetButton').addEventListener('click', function () {
    fetch('/reset', { method: 'POST' })
        .then(response => response.json())
        .then(data => alert(data.message));
});

document.getElementById('searchButton').addEventListener('click', function () {
    const query = document.getElementById('searchInput').value;
    fetch(`/search_files?query=${query}`)
        .then(response => response.json())
        .then(data => {
            // Update search results here
        });
});


