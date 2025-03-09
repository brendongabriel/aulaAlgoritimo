const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const app = express();
const port = 3001;
const cors = require("cors");

// Middleware para interpretar JSON
app.use(express.json());

// Middleware para permitir CORS
app.use(cors({
    origin: "http://localhost:3000" // Permite chamadas do React
}));

// Criação ou abertura do banco de dados SQLite
const db = new sqlite3.Database('./meu_banco.db', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados', err);
    } else {
        console.log('Conexão com o banco de dados estabelecida');

        // Criar tabela se não existir
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error("Erro ao criar a tabela", err);
            } else {
                // Verificar se os usuários Brendon e Milene já existem
                const users = [
                    { email: 'brendon3007gabriel@gmail.com', senha: '1234' },
                    { email: 'milene@gmail.com', senha: '9876' }
                ];

                users.forEach(user => {
                    // Verificar se o usuário já existe
                    db.get('SELECT * FROM usuarios WHERE email = ?', [user.email], (err, row) => {
                        if (err) {
                            console.error("Erro ao verificar usuário:", err);
                        } else if (!row) {
                            // Se não existir, inserir o usuário
                            const stmt = db.prepare("INSERT INTO usuarios (email, senha) VALUES (?, ?)");
                            stmt.run(user.email, user.senha, (err) => {
                                if (err) {
                                    console.error("Erro ao inserir usuário:", err);
                                }
                            });
                            stmt.finalize();
                        }
                    });
                });
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS sequence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT UNIQUE NOT NULL,
            sequenceNumbers TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES usuarios(id)
        )`);
    }
});

// Rota para buscar todos os usuários
app.get('/sequence/debug', (req, res) => {
    db.all('SELECT * FROM sequence', [], (err, rows) => {
        if (err) {
            res.status(500).send('Erro ao consultar dados');
        } else {
            res.json(rows);
        }
    });
});

app.get('/sequence/:userId', (req, res) => {
    const userId = req.params.userId;

    // Verificar se o usuário existe
    db.get("SELECT id FROM usuarios WHERE id = ?", [userId], (err, row) => {
        if (err) {
            console.error("Erro ao verificar usuário:", err);
            return res.status(500).send("Erro ao verificar usuário");
        }

        if (!row) {
            return res.status(404).send("Usuário não encontrado");
        }

        // Se o usuário existe, limpar sequências anteriores
        db.run("DELETE FROM sequence WHERE user_id = ?", [userId], (err) => {
            if (err) {
                console.error("Erro ao limpar sequências:", err);
                return res.status(500).send("Erro ao limpar sequências");
            }

            // Gerar nova sequência aleatória
            let numbers = Array.from({ length: 10 }, (_, i) => i);
            numbers.sort(() => Math.random() - 0.5);
            let sequence = [];
            for (let i = 0; i < numbers.length; i += 2) {
                sequence.push(numbers.slice(i, i + 2));
            }

            // Criar novo hash e salvar no banco
            const hash = crypto.randomUUID();
            const sequenceStr = JSON.stringify(sequence);
            const now = new Date().getTime();

            db.run(
                "INSERT INTO sequence (hash, sequenceNumbers, user_id, time) VALUES (?, ?, ?, ?)",
                [hash, sequenceStr, userId, now],
                function (err) {
                    if (err) {
                        console.error("Erro ao inserir nova sequência:", err);
                        return res.status(500).send("Erro ao salvar nova sequência");
                    }

                    res.json({ hash, sequence });
                }
            );
        });
    });
});

// Rota para gerar sequência aleatória semelhante a um teclado virtual e armazená-la no banco de dados
app.get('/users', (req, res) => {
    db.all('SELECT * FROM usuarios', [], (err, rows) => {
        if (err) {
            res.status(500).send('Erro ao consultar dados');
        } else {
            res.json(rows);
        }
    });
});

// Rota para buscar sequência pelo hash
app.get('/sequence/:hash', (req, res) => {
    const hash = req.params.hash;
    db.get('SELECT * FROM sequence WHERE hash = ?', [hash], (err, row) => {
        if (err) {
            res.status(500).send('Erro ao consultar dados');
        } else if (row) {
            res.json(row);
        } else {
            res.status(404).send('Sequência não encontrada');
        }
    });
});

app.post('/sequence/validate', (req, res) => {
    const { hash, sequence, id } = req.body;
    let error = false;

    if (!hash || !sequence || !id) {
        return res.status(400).send('Parâmetros inválidos');
    }

    // Verificar se o usuário existe
    db.get('SELECT * FROM usuarios WHERE id = ?', [id], (err, user) => {
        if (err) {
            return res.status(500).send('Erro ao consultar dados do usuário');
        } 
        if (!user) {
            return res.status(404).send('Usuário não encontrado');
        }

        // Buscar a sequência correspondente ao hash
        db.get('SELECT * FROM sequence WHERE hash = ?', [hash], (err, row) => {
            if (err) {
                return res.status(500).send('Erro ao consultar sequência');
            }
            if (!row) {
                return res.status(404).send('Sequência não encontrada');
            }

            // Verificar a sequência
            sequence.forEach((item, index) => {
                if (!JSON.stringify(row.sequenceNumbers).includes(JSON.stringify(item))) {
                    error = true;
                } else if (!item.includes(Number(user.senha[index]))) {
                    error = true;
                }
            });

            // Verificar tempo de expiração (60 segundos)
            if (new Date().getTime() - row.time > 60000) {
                error = true;
            }

            if (error) {
                return res.status(400).send('Usuário ou senha errada');
            }

            res.send('Bem-vindo');
        });
    });
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
