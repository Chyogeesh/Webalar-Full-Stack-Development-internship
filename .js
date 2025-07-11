const zip = require('adm-zip')();
zip.addLocalFolder('backend', 'backend');
zip.addLocalFolder('frontend/src', 'frontend/src');
zip.addLocalFile('README.md');
zip.addLocalFile('Logic_Document.md');
zip.addLocalFile('rfq_data.csv');
zip.writeZip('todo_board_assignment.zip');
