# Achados e Perdidos

Sistema web para a escola: quem encontra um objeto cadastra no site, e quem perdeu procura e vê como retirar.

**Problema:** objetos são encontrados na escola, mas os alunos não sabem onde procurar nem a quem pedir.
**Solução:** um sistema com cadastro, busca e controle de status de cada objeto.

## Tecnologias

| Parte | Tecnologia | O que faz |
|---|---|---|
| Frontend | HTML, CSS e JavaScript | As telas do site, os formulários e a busca |
| Backend | Node.js + Express | Recebe as requisições, aplica as regras e fala com o banco |
| API | REST com JSON | Comunicação entre o frontend e o backend |
| Banco de dados | Supabase (Postgres) | Guarda os objetos na tabela `objetos` do projeto `achados-perdidos` |

## Como rodar

1. Instale o **Node.js** (versão 22.13 ou mais nova; a versão LTS do site nodejs.org serve).
2. Crie um arquivo `.env` nesta pasta com a URL e a chave publicável do projeto Supabase `achados-perdidos`:

   ```
   SUPABASE_URL=https://SEU-PROJETO.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
   ```

3. Abra o terminal nesta pasta e rode:

   ```
   npm install
   npm start
   ```

4. Abra **http://localhost:3000** no navegador.

O projeto Supabase já começa com 8 objetos de exemplo.

## Estrutura

```
achados-e-perdidos/
├── server.js        → backend: servidor Express e rotas da API
├── db.js            → banco de dados: conversa com a tabela objetos no Supabase
├── package.json     → dependências e o comando npm start
└── public/          → frontend
    ├── index.html   → as 4 telas
    ├── style.css    → o visual
    └── app.js       → lógica das telas e chamadas para a API
```

## Telas

- **Início:** apresentação, botões principais e objetos encontrados recentemente
- **Objetos encontrados:** lista com busca e filtros por categoria, local e status
- **Cadastrar:** formulário com foto opcional e prévia do card. O objeto sempre entra disponível e sem dono
- **Gerenciar:** corrigir, excluir, desfazer uma reserva ou confirmar a retirada, com o painel das requisições feitas à API

## API (CRUD)

| Método | Endereço | Ação | Resposta |
|---|---|---|---|
| GET | `/api/objetos` | Listar todos (consulta) | 200 |
| GET | `/api/objetos/:id` | Ver um objeto | 200 ou 404 |
| POST | `/api/objetos` | Cadastrar (cadastro) | 201 ou 400 |
| PUT | `/api/objetos/:id` | Corrigir os dados, sem mudar dono nem situação | 200, 400 ou 404 |
| POST | `/api/objetos/:id/reivindicar` | O dono se identifica e marca a retirada | 200, 400, 404 ou 409 |
| POST | `/api/objetos/:id/cancelar` | Desfaz a reserva | 200, 400, 404 ou 409 |
| POST | `/api/objetos/:id/retirar` | A secretaria confirma a entrega | 200, 400, 404 ou 409 |
| DELETE | `/api/objetos/:id` | Excluir (exclusão) | 204 ou 404 |

Regras: nome, local e data são obrigatórios; a data é real e não pode ser no futuro. Um objeto novo nasce `disponivel` e sem dono. Só um objeto disponível pode ser reservado, e a reserva exige nome e contato do dono. A retirada só é confirmada depois da reserva. Objeto devolvido não volta atrás e não é editado.

## Banco de dados — tabela `objetos`

| Campo | Tipo | Descrição |
|---|---|---|
| id | número (chave primária) | Número do registro, criado automaticamente |
| nome | TEXT | Nome do objeto |
| categoria | TEXT | mochila, garrafa, chaves, estojo, roupa, eletronico, livro ou outros |
| descricao | TEXT | Cor, marca e detalhes |
| local_encontrado | TEXT | Onde foi encontrado |
| data_encontrada | data | Data em que foi encontrado |
| status | TEXT | disponivel (sem dono), aguardando (reserva) ou devolvido (entrega confirmada) |
| dono_nome | TEXT | Nome de quem reservou a retirada. Vazio enquanto está disponível |
| dono_contato | TEXT | Turma ou contato do dono, para a secretaria entregar |
| foto | TEXT | Foto enviada no cadastro (opcional) |
| desenho | TEXT | Desenho usado nos objetos de exemplo |
| criado_em | data e hora | Data e hora do cadastro |

## Fluxo

1. Quem encontrou cadastra o objeto. Ele fica **disponível** e sem dono.
2. Quem perdeu abre os detalhes, informa nome e contato e marca a retirada. O objeto fica **aguardando**.
3. Na secretaria, a entrega é confirmada. O objeto fica **devolvido** e o cadastro não muda mais.
4. Uma reserva errada pode ser desfeita, e o objeto volta a ficar disponível.

## Colocar online

O Netlify só hospeda sites estáticos, então ele não roda o backend. Para ter um link público, use um serviço que roda Node.js, como o **Render**:

1. Suba esta pasta para um repositório no GitHub.
2. No Render, crie um **Web Service** ligado ao repositório.
3. Build command: `npm install` · Start command: `npm start`

No Render, configure as mesmas variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` do arquivo `.env`. Os objetos ficam no Supabase, então continuam lá quando o serviço reinicia.
