import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Функция для добавления новой директории
async function addNewDirectory() {
    const folderName = await vscode.window.showInputBox({
        placeHolder: 'Enter the name of the new directory',
    });

    if (!folderName) {
        return;
    }

    const folderUri = await vscode.window.showInputBox({
        placeHolder: 'Enter the path where the directory will be created',
    });

    if (!folderUri) {
        return;
    }

    const dirPath = path.join(folderUri, folderName);

    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
            vscode.window.showInformationMessage(`Directory '${folderName}' created successfully at ${dirPath}`);
        } else {
            vscode.window.showErrorMessage(`Directory '${folderName}' already exists.`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create directory: ${error}`);
    }
}

// Функция для добавления нового конспекта в текущую директорию
async function addNewNotebook() {
    const notebookName = await vscode.window.showInputBox({
        placeHolder: 'Enter the name of the new notebook (without .md extension)',
    });

    if (!notebookName) {
        return;
    }

    const folderUri = await vscode.window.showInputBox({
        placeHolder: 'Enter the path where the notebook will be created',
    });

    if (!folderUri) {
        return;
    }

    const filePath = path.join(folderUri, `${notebookName}.md`);

    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, `# ${notebookName}\n\n`);
            vscode.window.showInformationMessage(`Notebook '${notebookName}.md' created successfully!`);
        } else {
            vscode.window.showErrorMessage(`Notebook '${notebookName}.md' already exists.`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create notebook: ${error}`);
    }
}

// Функция для добавления тегов в текущий конспект
async function addTagsToNotebook() {
    const openTextEditor = vscode.window.activeTextEditor;

    if (!openTextEditor || !openTextEditor.document.fileName.endsWith('.md')) {
        vscode.window.showErrorMessage('Please open a markdown notebook file to add tags.');
        return;
    }

    // Запрос на ввод тегов
    const tags = await vscode.window.showInputBox({
        placeHolder: 'Enter tags for the notebook, separated by commas (e.g., tag1, tag2)',
    });

    if (!tags) {
        return;
    }

    const tagList = tags.split(',').map(tag => tag.trim());

    const currentNotebookPath = openTextEditor.document.fileName;

    // Получаем содержимое текущего файла
    const content = openTextEditor.document.getText();

    // Проверяем, что теги ещё не добавлены
    const tagLineRegex = /<!-- Tags: ([^>]+) -->/;
    const match = content.match(tagLineRegex);

    if (match) {
        // Если теги уже есть, добавляем новые
        const existingTags = match[1].split(',').map(tag => tag.trim());
        const newTags = [...new Set([...existingTags, ...tagList])]; // Объединяем и удаляем дубли
        const newTagLine = `<!-- Tags: ${newTags.join(', ')} -->\n`;

        // Заменяем старую строку с тегами на новую
        const newContent = content.replace(tagLineRegex, newTagLine);
        fs.writeFileSync(currentNotebookPath, newContent);
        vscode.window.showInformationMessage('Tags updated in the notebook!');
    } else {
        // Если тегов нет, добавляем их в начало файла
        const tagLine = `<!-- Tags: ${tagList.join(', ')} -->\n`;
        const newContent = tagLine + content;
        fs.writeFileSync(currentNotebookPath, newContent);
        vscode.window.showInformationMessage('Tags added to the notebook!');
    }
}

// Функция для выделения текста в выбранный цвет в формате Markdown
async function highlightTextInColor() {
    const color = await vscode.window.showInputBox({
        placeHolder: 'Enter the color for highlighting text (e.g., red, #ff0000)',
    });

    if (!color) {
        return;
    }

    const openTextEditor = vscode.window.activeTextEditor;

    if (!openTextEditor || openTextEditor.selection.isEmpty) {
        vscode.window.showErrorMessage('Please select text to highlight.');
        return;
    }

    const selectedText = openTextEditor.document.getText(openTextEditor.selection);

    // Создаём Markdown-стиль с HTML для изменения цвета
    const coloredText = `<span style="color: ${color};">${selectedText}</span>`;

    // Заменяем выделенный текст на новый с цветом
    openTextEditor.edit(editBuilder => {
        editBuilder.replace(openTextEditor.selection, coloredText);
    });

    // Подтверждение пользователю, что выделение выполнено
    vscode.window.showInformationMessage(`Text highlighted in ${color}!`);
}

// Функция для поиска конспектов по тегу с выбором директории
async function showNotebooksByTag() {
    const folderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Folder to Search Notebooks',
    });

    if (!folderUri || folderUri.length === 0) {
        return;
    }

    const tag = await vscode.window.showInputBox({
        placeHolder: 'Enter the tag to search for',
    });

    if (!tag) {
        return;
    }

    const folderPath = folderUri[0].fsPath;

    // Рекурсивная функция для поиска всех файлов .md в папке и подкаталогах
    function getNotebooksFromDirectory(dirPath: string): string[] {
        let notebooks: string[] = [];
        const files = fs.readdirSync(dirPath, { withFileTypes: true });

        files.forEach(file => {
            const filePath = path.join(dirPath, file.name);
            if (file.isDirectory()) {
                // Рекурсивно ищем в подкаталогах
                notebooks = notebooks.concat(getNotebooksFromDirectory(filePath));
            } else if (file.isFile() && file.name.endsWith('.md')) {
                notebooks.push(filePath);
            }
        });

        return notebooks;
    }

    const notebooks = getNotebooksFromDirectory(folderPath);

    // Поиск файлов, которые содержат нужный тег
    const matchedNotebooks = notebooks.filter(notebookPath => {
        const content = fs.readFileSync(notebookPath, 'utf-8');
        
        // Ищем тег в строках вида <!-- Tags: ... -->
        const tagLineRegex = /<!-- Tags: ([^>]+) -->/;
        const match = content.match(tagLineRegex);
        if (match) {
            // Разбиваем строку на отдельные теги и проверяем наличие нужного
            const tags = match[1].split(',').map(tag => tag.trim());
            return tags.includes(tag);
        }
        return false;
    });

    if (matchedNotebooks.length === 0) {
        vscode.window.showInformationMessage('No notebooks found with that tag.');
        return;
    }

    // Показать список найденных конспектов
    const notebookNames = matchedNotebooks.map(notebook => path.basename(notebook));
    const selectedNotebook = await vscode.window.showQuickPick(notebookNames, {
        placeHolder: 'Select a notebook to open',
    });

    if (!selectedNotebook) {
        return;
    }

    const selectedNotebookPath = matchedNotebooks[notebookNames.indexOf(selectedNotebook)];
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(selectedNotebookPath));
    vscode.window.showTextDocument(document);
}

// Функция для вставки изображения в текущий конспект
async function insertImageInNotebook() {
    const openTextEditor = vscode.window.activeTextEditor;

    if (!openTextEditor || !openTextEditor.document.fileName.endsWith('.md')) {
        vscode.window.showErrorMessage('Please open a markdown notebook file to insert an image.');
        return;
    }

    // Диалог выбора изображения
    const imageUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Select Image',
        filters: {
            'Images': ['png', 'jpg', 'jpeg', 'gif'],
        },
    });

    if (!imageUri || imageUri.length === 0) {
        return;
    }

    const imagePath = imageUri[0].fsPath;
    const imageMarkdown = `![Image](${imagePath})`;

    // Вставляем картинку в текущую позицию курсора
    openTextEditor.edit(editBuilder => {
        editBuilder.insert(openTextEditor.selection.start, `\n\n${imageMarkdown}\n`);
    });

    vscode.window.showInformationMessage('Image inserted successfully!');
}

// Регистрация команд
export function activate(context: vscode.ExtensionContext) {
    let disposableAddDirectory = vscode.commands.registerCommand('extension.addNewDirectory', addNewDirectory);
    let disposableAddNotebook = vscode.commands.registerCommand('extension.addNewNotebook', addNewNotebook);
    let disposableAddTags = vscode.commands.registerCommand('extension.addTagsToNotebook', addTagsToNotebook);
    let disposableHighlightText = vscode.commands.registerCommand('extension.highlightTextInColor', highlightTextInColor);
    let disposableSearchNotebooks = vscode.commands.registerCommand('extension.showNotebooksByTag', showNotebooksByTag);
    let disposableInsertImage = vscode.commands.registerCommand('extension.insertImageInNotebook', insertImageInNotebook);

    context.subscriptions.push(disposableAddDirectory, disposableAddNotebook, disposableAddTags, disposableHighlightText, disposableSearchNotebooks, disposableInsertImage);
}

// Деактивация расширения
export function deactivate() {}
