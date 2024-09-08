const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(cors({
    origin: '*',         // Allow all origins
    methods: '*',        // Allow all HTTP methods
    allowedHeaders: '*', // Allow all headers
  }));
  
app.use(bodyParser.json());

app.use('/images', express.static(path.join(__dirname, 'images')));


// Initialize SQLite Database
const db = new sqlite3.Database(':memory:');

// Create tables for questions, choices, and user answers
db.serialize(() => {
    db.run(`CREATE TABLE questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT,
        is_image BOOLEAN,
        image_path TEXT
    )`);

    db.run(`CREATE TABLE choices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER,
        choice_text TEXT,
        is_correct BOOLEAN
    )`);

    db.run(`CREATE TABLE user_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER,
        selected_choice_ids TEXT,  -- Store selected choice IDs as a string
        is_correct BOOLEAN
    )`);

    // Insert 10 questions and their choices into the database
    const questions = [
        {
            question: "What is the capital of France?",
            choices: [
                { choice_text: "Paris", is_correct: true },
                { choice_text: "London", is_correct: false },
                { choice_text: "Rome", is_correct: false },
                { choice_text: "Berlin", is_correct: false }
            ],
            isImage: false,
            imagePath: ''
        },
        {
            question: "Which languages are used in web development?",
            choices: [
                { choice_text: "JavaScript", is_correct: true },
                { choice_text: "Python", is_correct: false },
                { choice_text: "Java", is_correct: false },
                { choice_text: "HTML", is_correct: true }
            ],
            isImage: false,
            imagePath: ''
        },
        {
            question: "Which of the following are programming languages?",
            choices: [
                { choice_text: "C++", is_correct: true },
                { choice_text: "Spanish", is_correct: false },
                { choice_text: "Ruby", is_correct: true },
                { choice_text: "HTML", is_correct: false }
            ],
            isImage: false,
            imagePath: ''
        },
        {
            question: "Which planets are in the Solar System?",
            choices: [
                { choice_text: "Earth", is_correct: true },
                { choice_text: "Mars", is_correct: true },
                { choice_text: "Pluto", is_correct: true },
                { choice_text: "Proxima Centauri", is_correct: false }
            ],
            isImage: true,
            imagePath: 'solar_system.webp',
        },
        {
            question: "What are the primary colors?",
            choices: [
                { choice_text: "Red", is_correct: true },
                { choice_text: "Blue", is_correct: true },
                { choice_text: "Yellow", is_correct: true },
                { choice_text: "Green", is_correct: false }
            ],
            isImage: false,
            imagePath: ''
        },
        {
            question: "What is 2 + 2?",
            choices: [
                { choice_text: "3", is_correct: false },
                { choice_text: "4", is_correct: true },
                { choice_text: "5", is_correct: false },
                { choice_text: "6", is_correct: false }
            ],
            isImage: false,
            imagePath: ''
        },
        {
            question: "Which of these are fruits?",
            choices: [
                { choice_text: "Apple", is_correct: true },
                { choice_text: "Tomato", is_correct: true },
                { choice_text: "Carrot", is_correct: false },
                { choice_text: "Banana", is_correct: true }
            ],
            isImage: true,
            imagePath: 'fruits.jpeg'
        },
        {
            question: "Which countries are in Europe?",
            choices: [
                { choice_text: "Germany", is_correct: true },
                { choice_text: "Brazil", is_correct: false },
                { choice_text: "Italy", is_correct: true },
                { choice_text: "Japan", is_correct: false }
            ],
            isImage: false,
            imagePath: ''
        },
        {
            question: "Which are valid CSS properties?",
            choices: [
                { choice_text: "color", is_correct: true },
                { choice_text: "margin", is_correct: true },
                { choice_text: "padding", is_correct: true },
                { choice_text: "hover", is_correct: false }
            ],
            isImage: false,
            imagePath: ''
        },
        {
            question: "Which of the following are JavaScript frameworks?",
            choices: [
                { choice_text: "React", is_correct: true },
                { choice_text: "Angular", is_correct: true },
                { choice_text: "Django", is_correct: false },
                { choice_text: "Vue", is_correct: true }
            ],
            isImage: false,
            imagePath: ''
        }
    ];

    // For each question, prepare and execute insert statements
    questions.forEach((q) => {
        // Prepare and execute question insert
        db.run("INSERT INTO questions (question, is_image, image_path) VALUES (?, ?, ?)", [q.question, q.isImage, q.imagePath], function (err) {
            if (err) {
                console.error(err.message);
                return;
            }

            const questionId = this.lastID;

            // Prepare and execute choices insert for each question
            q.choices.forEach((choice) => {
                db.run("INSERT INTO choices (question_id, choice_text, is_correct) VALUES (?, ?, ?)", 
                [questionId, choice.choice_text, choice.is_correct], 
                (err) => {
                    if (err) {
                        console.error(err.message);
                    }
                });
            });
        });
    });
});

// API to get a question by ID
app.get('/api/question/:id', (req, res) => {
    const questionId = req.params.id;
    db.get('SELECT * FROM questions WHERE id = ?', [questionId], (err, questionRow) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (questionRow) {
            db.all('SELECT id, choice_text FROM choices WHERE question_id = ?', [questionId], (err, choiceRows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                var image_path = '';

                if(questionRow.is_image){
                    image_path = `${req.protocol}://${req.get('host')}/images/${questionRow.image_path}`
                }

                res.json({
                    question: questionRow.question,
                    choices: choiceRows.map(choice => ({ choice_id: choice.id, choice_text: choice.choice_text })),
                    is_image: questionRow.is_image,
                    image_path: image_path,
                });
            });
        } else {
            res.status(404).json({ message: 'Question not found' });
        }
    });
});

// API to submit answer by choice IDs
app.post('/api/question/:id/answer', (req, res) => {
    const questionId = req.params.id;
    const selectedChoiceIds = req.body.selected_choice_ids; // Array of choice IDs

    // Get the correct answers for the question
    db.all('SELECT id FROM choices WHERE question_id = ? AND is_correct = 1', [questionId], (err, correctChoices) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if(correctChoices.length > 0){

            const correctChoiceIds = correctChoices.map(c => c.id);
            const isCorrect = selectedChoiceIds.sort().toString() === correctChoiceIds.sort().toString();

            // Store the answer submission
            db.run(`INSERT INTO user_answers (question_id, selected_choice_ids, is_correct) VALUES (?, ?, ?)`,
                [questionId, JSON.stringify(selectedChoiceIds), isCorrect],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    res.json({ is_correct: isCorrect });
                });
        } else {
            res.status(404).json({ message: 'Question not found' });
        }
    });
});

// API to fetch final score after the last question
app.get('/api/score', (req, res) => {
    db.all('SELECT * FROM user_answers', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const totalQuestions = rows.length;
        const correctAnswers = rows.filter(row => row.is_correct).length;
        const incorrectAnswers = totalQuestions - correctAnswers;

        res.json({
            total_questions: totalQuestions,
            correct_answers: correctAnswers,
            incorrect_answers: incorrectAnswers
        });
    });
});

// API to clear previous scores (Retest)
app.post('/api/retest', (req, res) => {
    db.run('DELETE FROM user_answers', (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        res.json({ message: 'Previous scores cleared. You can now take the test again.' });
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
