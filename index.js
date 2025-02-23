const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const app = express();
const port = 3000;

// Middleware para interpretar JSON
app.use(express.json());

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
                console.log("Tabela 'usuarios' criada ou já existe");

                // Limpar a tabela antes de inserir novos dados
                db.run('DELETE FROM usuarios', (err) => {
                    if (err) {
                        console.error('Erro ao limpar tabela:', err);
                    } else {
                        console.log('Tabela limpa');

                        // Inserir dados iniciais
                        const stmt = db.prepare("INSERT INTO usuarios (email, senha) VALUES (?, ?)");
                        stmt.run('brendon3007gabriel@gmail.com', '1234', (err) => {
                            if (err) {
                                console.error("Erro ao inserir dados iniciais:", err);
                            } else {
                                console.log("Usuário inicial inserido");
                            }
                        });

                        stmt.run('milene@gmail.com', '9876', (err) => {
                            if (err) {
                                console.error("Erro ao inserir dados iniciais:", err);
                            } else {
                                console.log("Usuário inicial inserido");
                            }
                        });

                        stmt.finalize();
                    }
                });
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS sequence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT UNIQUE NOT NULL,
    sequenceNumbers TEXT NOT NULL,
    time DATETIME DEFAULT CURRENT_TIMESTAMP
)`)
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

// Rota para gerar sequência aleatória semelhante a um teclado virtual e armazená-la no banco de dados
app.get('/sequence', (req, res) => {
    let numbers = Array.from({
        length: 10
    }, (_, i) => i);
    numbers.sort(() => Math.random() - 0.5);
    let sequence = [];
    for (let i = 0; i < numbers.length; i += 2) {
        sequence.push(numbers.slice(i, i + 2));
    }

    const hash = crypto.randomUUID();
    const sequenceStr = JSON.stringify(sequence);
    const now = new Date().getTime();
    const stmt = db.prepare("INSERT INTO sequence (hash, sequenceNumbers, time) VALUES (?, ?, ?)");
    stmt.run(hash, sequenceStr, now, (err) => {
        if (err) {
            console.error("Erro ao inserir sequência:", err);
            res.status(500).send('Erro ao salvar sequência');
        } else {
            res.json({
                hash,
                sequence
            });
        }
    });
    stmt.finalize();
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

// Rota para validar sequência de acordo com o que usuário digitou
app.post('/sequence/validate', (req, res) => {
    let error = false;
    const {
        hash,
        sequence,
        email
    } = req.body;

    if (!hash || !sequence || !email) {
        res.status(400).send('Parâmetros inválidos');
        return;
    }
    let user;
    db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, row) => {
        if (err) {
            res.status(500).send('Erro ao consultar dados');
        } else if (row) {
            user = row;
        } else {
            res.status(404).send('Usuário não encontrado');
            return;
        }
    });

    db.get('SELECT * FROM sequence WHERE hash = ?', [hash], (err, row) => {
        if (err) {
            res.status(500).send('Erro ao consultar dados');
        } else if (row) {
            sequence.forEach((item, index) => {
                if (!JSON.stringify(row.sequenceNumbers).includes(JSON.stringify(item))) {
                    error = true;
                } else {
                    if (!item.includes(Number(user.senha[index]))) {
                        error = true;
                    }
                }
            });

            // if (new Date().getTime() - row.time > 60000) {
            //     error = true;
            // }
        } else {
            res.status(404).send('Sequência não encontrada');
        }

        if (error) {
            res.status(400).send('Usuário ou senha errada');
        } else {
            res.send('Bem vindo');
        }
    });
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});