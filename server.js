// ===================================================================
// BACKEND (Node.js + Express)
// Recebe as requisições do frontend, aplica as regras do sistema
// e conversa com o banco de dados.
//
// Um objeto encontrado nasce disponível e sem dono.
// Outra pessoa se identifica e marca a retirada.
// A secretaria confirma a entrega, e aí o registro não muda mais.
// ===================================================================
const fs = require('node:fs');
const path = require('node:path');

// No computador, as chaves ficam no .env. No Render elas já vêm do painel,
// e uma variável que já existe no ambiente não é substituída.
const arquivoEnv = path.join(__dirname, '.env');
if (fs.existsSync(arquivoEnv)) {
  process.loadEnvFile(arquivoEnv);
}

const express = require('express');
const db = require('./db');

const app = express();
const PORTA = process.env.PORT || 3000;

// Entende o corpo das requisições em JSON (limite maior por causa das fotos)
app.use(express.json({ limit: '5mb' }));

// Entrega os arquivos do frontend (pasta public)
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------------
// REGRAS DO SISTEMA
// -------------------------------------------------------------------
const CATEGORIAS = ['mochila', 'garrafa', 'chaves', 'estojo', 'roupa', 'eletronico', 'livro', 'outros'];

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function dataReal(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || '')) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

function hoje() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function idDaRota(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ erro: 'Objeto não encontrado.' });
    return null;
  }
  return id;
}

// Confere os dados do objeto. Situação e dono não entram aqui:
// eles só mudam na reserva e na confirmação da retirada.
function validar(o) {
  const erros = [];
  if (!texto(o.nome)) erros.push('O nome do objeto é obrigatório.');
  if (texto(o.nome).length > 60) erros.push('O nome pode ter no máximo 60 letras.');
  if (!CATEGORIAS.includes(o.categoria)) erros.push('Categoria inválida.');
  if (!texto(o.local_encontrado)) erros.push('O local onde foi encontrado é obrigatório.');
  if (texto(o.local_encontrado).length > 40) erros.push('O local pode ter no máximo 40 letras.');
  if (!dataReal(o.data_encontrada)) erros.push('A data deve estar no formato AAAA-MM-DD.');
  else if (o.data_encontrada > hoje()) erros.push('A data em que o objeto foi encontrado não pode ser no futuro.');
  if (o.descricao && String(o.descricao).length > 280) erros.push('A descrição pode ter no máximo 280 letras.');
  if (o.foto && !String(o.foto).startsWith('data:image/')) erros.push('A foto precisa ser uma imagem.');
  return erros;
}

function validarAcesso(body) {
  const login = texto(body.login);
  const senha = texto(body.senha);
  const erros = [];
  if (login.length < 3) erros.push('O login precisa ter pelo menos 3 letras.');
  else if (login.length > 40) erros.push('O login pode ter no máximo 40 letras.');
  else if (/\s/.test(login)) erros.push('O login não pode ter espaço.');
  if (senha.length < 4) erros.push('A senha precisa ter pelo menos 4 letras.');
  else if (senha.length > 40) erros.push('A senha pode ter no máximo 40 letras.');
  return { login, senha, erros };
}

function validarDono(body) {
  const nome = texto(body.dono_nome);
  const contato = texto(body.dono_contato);
  const erros = [];
  if (!nome) erros.push('O nome do dono é obrigatório.');
  if (nome.length > 60) erros.push('O nome do dono pode ter no máximo 60 letras.');
  if (!contato) erros.push('O contato do dono é obrigatório.');
  if (contato.length > 80) erros.push('O contato pode ter no máximo 80 letras.');
  return { nome, contato, erros };
}

function buscarPorId(id) {
  return db.buscarObjeto(id);
}

// -------------------------------------------------------------------
// API — ENDPOINTS DO CRUD
// -------------------------------------------------------------------

// GET /api/objetos → lista todos os objetos (consulta)
app.get('/api/objetos', async (req, res) => {
  const objetos = await db.listarObjetos();
  res.json(objetos);
});

// GET /api/objetos/:id → mostra um objeto
app.get('/api/objetos/:id', async (req, res) => {
  const id = idDaRota(req, res);
  if (id == null) return;
  const objeto = await buscarPorId(id);
  if (!objeto) return res.status(404).json({ erro: 'Objeto não encontrado.' });
  res.json(objeto);
});

// POST /api/objetos → cadastra um objeto encontrado, sempre disponível e sem dono
app.post('/api/objetos', async (req, res) => {
  const novo = {
    nome: texto(req.body.nome),
    categoria: req.body.categoria,
    descricao: texto(req.body.descricao),
    local_encontrado: texto(req.body.local_encontrado),
    data_encontrada: req.body.data_encontrada,
    foto: req.body.foto || null
  };

  const acesso = validarAcesso(req.body);
  const erros = validar(novo).concat(acesso.erros);
  if (erros.length) return res.status(400).json({ erro: erros.join(' ') });

  const entrada = await db.entrar(acesso.login, acesso.senha);
  if (entrada.erro) return res.status(401).json({ erro: entrada.erro });

  res.status(201).json(await db.criarObjeto(novo));
});

// PUT /api/objetos/:id → corrige os dados do objeto, sem mexer no dono nem na situação
app.put('/api/objetos/:id', async (req, res) => {
  const id = idDaRota(req, res);
  if (id == null) return;
  const atual = await buscarPorId(id);
  if (!atual) return res.status(404).json({ erro: 'Objeto não encontrado.' });
  if (atual.status === 'devolvido') {
    return res.status(400).json({ erro: 'Objeto já devolvido não pode ser alterado.' });
  }

  const campos = ['nome', 'categoria', 'descricao', 'local_encontrado', 'data_encontrada', 'foto'];
  const atualizado = { ...atual };
  for (const campo of campos) {
    if (req.body[campo] !== undefined) atualizado[campo] = req.body[campo];
  }
  atualizado.nome = texto(atualizado.nome);
  atualizado.descricao = texto(atualizado.descricao);
  atualizado.local_encontrado = texto(atualizado.local_encontrado);

  // Se mudou a categoria, o desenho antigo não serve mais
  if (atualizado.categoria !== atual.categoria) atualizado.desenho = null;

  const erros = validar(atualizado);
  if (erros.length) return res.status(400).json({ erro: erros.join(' ') });

  const salvo = await db.atualizarObjeto(id, atualizado);
  if (!salvo) {
    const deNovo = await buscarPorId(id);
    if (!deNovo) return res.status(404).json({ erro: 'Objeto não encontrado.' });
    return res.status(400).json({ erro: 'Objeto já devolvido não pode ser alterado.' });
  }
  res.json(salvo);
});

// POST /api/objetos/:id/reivindicar → outra pessoa se identifica como dono e marca a retirada
app.post('/api/objetos/:id/reivindicar', async (req, res) => {
  const id = idDaRota(req, res);
  if (id == null) return;
  const atual = await buscarPorId(id);
  if (!atual) return res.status(404).json({ erro: 'Objeto não encontrado.' });
  if (atual.status === 'devolvido') {
    return res.status(400).json({ erro: 'Este objeto já foi devolvido.' });
  }
  if (atual.status === 'aguardando') {
    return res.status(409).json({ erro: 'Este objeto já está reservado para ' + atual.dono_nome + '.' });
  }

  const dono = validarDono(req.body);
  if (dono.erros.length) return res.status(400).json({ erro: dono.erros.join(' ') });

  const salvo = await db.reivindicarObjeto(id, dono);
  if (!salvo) return res.status(409).json({ erro: 'Alguém acabou de reservar este objeto.' });
  res.json(salvo);
});

// POST /api/objetos/:id/cancelar → desfaz a reserva e o objeto volta a ficar sem dono
app.post('/api/objetos/:id/cancelar', async (req, res) => {
  const id = idDaRota(req, res);
  if (id == null) return;
  const atual = await buscarPorId(id);
  if (!atual) return res.status(404).json({ erro: 'Objeto não encontrado.' });
  if (atual.status !== 'aguardando') {
    return res.status(400).json({ erro: 'Só dá para desfazer a reserva de um objeto que está aguardando retirada.' });
  }

  const salvo = await db.cancelarReserva(id);
  if (!salvo) return res.status(409).json({ erro: 'A situação deste objeto mudou. Atualize a página.' });
  res.json(salvo);
});

// POST /api/objetos/:id/retirar → a secretaria confirma que o dono já levou o objeto
app.post('/api/objetos/:id/retirar', async (req, res) => {
  const id = idDaRota(req, res);
  if (id == null) return;
  const atual = await buscarPorId(id);
  if (!atual) return res.status(404).json({ erro: 'Objeto não encontrado.' });
  if (atual.status === 'disponivel') {
    return res.status(400).json({ erro: 'Só dá para confirmar a retirada depois que um dono reservar o objeto.' });
  }
  if (atual.status === 'devolvido') {
    return res.status(400).json({ erro: 'Este objeto já foi devolvido.' });
  }

  const salvo = await db.confirmarRetirada(id);
  if (!salvo) return res.status(409).json({ erro: 'A situação deste objeto mudou. Atualize a página.' });
  res.json(salvo);
});

// DELETE /api/objetos/:id → exclui um objeto (exclusão)
app.delete('/api/objetos/:id', async (req, res) => {
  const id = idDaRota(req, res);
  if (id == null) return;
  const excluiu = await db.excluirObjeto(id);
  if (!excluiu) return res.status(404).json({ erro: 'Objeto não encontrado.' });
  res.status(204).end();
});

// Qualquer outro endereço da API que não existe
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Endereço da API não encontrado.' });
});

// Se der algum erro inesperado (ex.: JSON quebrado ou foto grande demais)
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(400).json({ erro: 'A foto é grande demais.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Os dados enviados não são um JSON válido.' });
  console.error(err);
  res.status(500).json({ erro: 'Erro no servidor.' });
});

app.listen(PORTA, () => {
  console.log('Achados e Perdidos rodando em http://localhost:' + PORTA);
});
