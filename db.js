// ===================================================================
// BANCO DE DADOS
// Os objetos ficam na tabela "objetos" do projeto Supabase
// achados-perdidos. O frontend continua falando só com esta API.
//
// Situação de cada objeto:
//   disponivel → sem dono
//   aguardando → um dono reservou a retirada
//   devolvido  → a secretaria confirmou a entrega e o registro trava
// ===================================================================
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no arquivo .env.');
  process.exit(1);
}

const supabase = createClient(url, key);

function falha(error) {
  console.error(error);
  const err = new Error('Não foi possível falar com o Supabase.');
  err.cause = error;
  throw err;
}

function normalizar(row) {
  if (!row) return row;
  return {
    ...row,
    id: Number(row.id),
    data_encontrada: String(row.data_encontrada).slice(0, 10)
  };
}

async function listarObjetos() {
  const { data, error } = await supabase
    .from('objetos')
    .select('*')
    .order('data_encontrada', { ascending: false })
    .order('id', { ascending: false });
  if (error) falha(error);
  return data.map(normalizar);
}

async function buscarObjeto(id) {
  const { data, error } = await supabase
    .from('objetos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) falha(error);
  return normalizar(data);
}

async function entrar(login, senha) {
  const busca = await supabase.from('usuarios').select('senha').eq('login', login).maybeSingle();
  if (busca.error) falha(busca.error);
  if (busca.data) {
    if (busca.data.senha !== senha) return { erro: 'Senha incorreta para este login.' };
    return { ok: true };
  }

  const criado = await supabase.from('usuarios').insert({ login, senha }).select('login').maybeSingle();
  if (!criado.error) return { ok: true };
  if (criado.error.code !== '23505') falha(criado.error);

  const deNovo = await supabase.from('usuarios').select('senha').eq('login', login).maybeSingle();
  if (deNovo.error) falha(deNovo.error);
  if (deNovo.data && deNovo.data.senha === senha) return { ok: true };
  return { erro: 'Senha incorreta para este login.' };
}

async function criarObjeto(objeto) {
  const { data, error } = await supabase
    .from('objetos')
    .insert({
      nome: objeto.nome,
      categoria: objeto.categoria,
      descricao: objeto.descricao,
      local_encontrado: objeto.local_encontrado,
      data_encontrada: objeto.data_encontrada,
      foto: objeto.foto || null
    })
    .select()
    .single();
  if (error) falha(error);
  return normalizar(data);
}

async function atualizarObjeto(id, objeto) {
  const { data, error } = await supabase
    .from('objetos')
    .update({
      nome: objeto.nome,
      categoria: objeto.categoria,
      descricao: objeto.descricao,
      local_encontrado: objeto.local_encontrado,
      data_encontrada: objeto.data_encontrada,
      foto: objeto.foto || null,
      desenho: objeto.desenho || null
    })
    .eq('id', id)
    .neq('status', 'devolvido')
    .select()
    .maybeSingle();
  if (error) falha(error);
  return normalizar(data);
}

async function reivindicarObjeto(id, dono) {
  const { data, error } = await supabase
    .from('objetos')
    .update({
      status: 'aguardando',
      dono_nome: dono.nome,
      dono_contato: dono.contato
    })
    .eq('id', id)
    .eq('status', 'disponivel')
    .select()
    .maybeSingle();
  if (error) falha(error);
  return normalizar(data);
}

async function cancelarReserva(id) {
  const { data, error } = await supabase
    .from('objetos')
    .update({
      status: 'disponivel',
      dono_nome: null,
      dono_contato: null
    })
    .eq('id', id)
    .eq('status', 'aguardando')
    .select()
    .maybeSingle();
  if (error) falha(error);
  return normalizar(data);
}

async function confirmarRetirada(id) {
  const { data, error } = await supabase
    .from('objetos')
    .update({ status: 'devolvido' })
    .eq('id', id)
    .eq('status', 'aguardando')
    .select()
    .maybeSingle();
  if (error) falha(error);
  return normalizar(data);
}

async function excluirObjeto(id) {
  const { data, error } = await supabase
    .from('objetos')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) falha(error);
  return data.length > 0;
}

module.exports = {
  listarObjetos,
  buscarObjeto,
  entrar,
  criarObjeto,
  atualizarObjeto,
  reivindicarObjeto,
  cancelarReserva,
  confirmarRetirada,
  excluirObjeto
};
