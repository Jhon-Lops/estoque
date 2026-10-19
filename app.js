
const SUPABASE_URL = "https://lgglxgdcrbmrhfradszk.supabase.co";
const SUPABASE_CHAVE_PUBLICA = "sb_publishable_tJ-SqQkXS0Wtk1-rkWZQeQ_iRZsJZkh";
const clienteSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_CHAVE_PUBLICA
);

const CHAVE_PRODUTOS = "meuEstoque_produtos_v1";
const CHAVE_HISTORICO = "meuEstoque_historico_v1";

let produtos = carregar(CHAVE_PRODUTOS);
let historico = carregar(CHAVE_HISTORICO);
let modoCadastro = false;

const porId = id => document.getElementById(id);

function mostrarAplicacao(usuario) {
  porId("login").classList.add("escondida");
  porId("aplicacao").classList.remove("escondida");
  const nickname = usuario.user_metadata?.nickname || usuario.email;
  porId("usuarioLogado").textContent =
    `${nickname} (${usuario.user_metadata?.role === "admin" ? "Administrador" : "Usuário"})`;
  atualizarTela();
}

function mostrarLogin() {
  porId("login").classList.remove("escondida");
  porId("aplicacao").classList.add("escondida");
}

async function iniciarAutenticacao() {
  const { data: { session } } = await clienteSupabase.auth.getSession();
  if (session?.user) mostrarAplicacao(session.user);

  clienteSupabase.auth.onAuthStateChange((_evento, novaSessao) => {
    if (novaSessao?.user) mostrarAplicacao(novaSessao.user);
    else mostrarLogin();
  });
}

porId("formLogin").addEventListener("submit", async evento => {
  evento.preventDefault();
  const email = porId("emailLogin").value.trim();
  const senha = porId("senhaLogin").value;
  const nickname = porId("nicknameLogin").value.trim();
  const mensagem = porId("mensagemLogin");
  mensagem.textContent = "Aguarde...";

  const resultado = modoCadastro
    ? await clienteSupabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nickname, role: "user" } }
      })
    : await clienteSupabase.auth.signInWithPassword({ email, password: senha });

  if (resultado.error) {
    mensagem.textContent = resultado.error.message;
    return;
  }

  mensagem.textContent = modoCadastro
    ? "Conta criada. Verifique seu e-mail para confirmar o acesso."
    : "";
});

porId("alternarCadastro").addEventListener("click", () => {
  modoCadastro = !modoCadastro;
  porId("textoLogin").textContent = modoCadastro
    ? "Crie sua conta para acessar o estoque."
    : "Entre para acessar o estoque.";
  porId("botaoLogin").textContent = modoCadastro ? "Criar conta" : "Entrar";
  porId("alternarCadastro").textContent = modoCadastro
    ? "Já tenho uma conta"
    : "Criar uma conta";
  porId("labelNickname").classList.toggle("escondida", !modoCadastro);
  porId("nicknameLogin").classList.toggle("escondida", !modoCadastro);
  porId("nicknameLogin").required = modoCadastro;
});

porId("botaoSair").addEventListener("click", async () => {
  const { error } = await clienteSupabase.auth.signOut();
  if (error) porId("mensagemLogin").textContent = error.message;
});

function carregar(chave) {
  try {
    const dados = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function salvarDados() {
  try {
    localStorage.setItem(CHAVE_PRODUTOS, JSON.stringify(produtos));
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
    return true;
  } catch (erro) {
    alert("Não foi possível salvar. Verifique o espaço disponível.");
    return false;
  }
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caractere]);
}

function formatarData(data) {
  return new Date(data).toLocaleString("pt-BR");
}

function estadoProduto(produto) {
  if (produto.quantidade === 0) return "Esgotado";
  if (produto.quantidade <= produto.minimo) return "Estoque baixo";
  return "Normal";
}

function classeEstado(produto) {
  if (produto.quantidade === 0) return "vermelho";
  if (produto.quantidade <= produto.minimo) return "";
  return "verde";
}

// Navegação entre as abas
document.querySelectorAll("[data-aba]").forEach(botao => {
  botao.addEventListener("click", () => {
    document.querySelectorAll(".aba").forEach(aba => {
      aba.classList.add("escondida");
    });

    porId(botao.dataset.aba).classList.remove("escondida");

    document.querySelectorAll("[data-aba]").forEach(item => {
      item.classList.toggle("ativo", item === botao);
    });

    atualizarTela();
  });
});

// Cadastro de produto
porId("formProduto").addEventListener("submit", evento => {
  evento.preventDefault();

  const nome = porId("nome").value.trim();
  const categoria = porId("categoria").value.trim();
  const quantidade = Number(porId("quantidade").value);
  const minimo = Number(porId("minimo").value);

  if (
    !nome ||
    !Number.isSafeInteger(quantidade) ||
    quantidade < 0 ||
    !Number.isSafeInteger(minimo) ||
    minimo < 0
  ) {
    porId("mensagemProduto").textContent =
      "Confira o nome e as quantidades informadas.";
    return;
  }

  const produto = {
    id: crypto.randomUUID(),
    nome,
    categoria,
    quantidade,
    minimo
  };

  const anterior = produtos;
  produtos = [...produtos, produto];

  if (!salvarDados()) {
    produtos = anterior;
    return;
  }

  if (quantidade > 0) {
    historico.unshift({
      id: crypto.randomUUID(),
      produtoId: produto.id,
      nome: produto.nome,
      tipo: "entrada",
      quantidade,
      observacao: "Estoque inicial",
      data: new Date().toISOString()
    });

    if (!salvarDados()) {
      historico.shift();
      produtos = anterior;
      salvarDados();
      return;
    }
  }

  porId("formProduto").reset();
  porId("quantidade").value = 0;
  porId("minimo").value = 5;
  porId("mensagemProduto").textContent = "Produto salvo com sucesso!";

  atualizarTela();
});

// Entrada e saída de mercadorias
porId("formMovimentacao").addEventListener("submit", evento => {
  evento.preventDefault();

  const produtoId = porId("produtoMov").value;
  const tipo = porId("tipoMov").value;
  const quantidade = Number(porId("qtdMov").value);
  const observacao = porId("obsMov").value.trim();

  const produto = produtos.find(p => p.id === produtoId);

  if (!produto) {
    porId("mensagemMov").textContent = "Selecione um produto válido.";
    return;
  }

  if (!Number.isSafeInteger(quantidade) || quantidade <= 0) {
    porId("mensagemMov").textContent =
      "Informe uma quantidade inteira maior que zero.";
    return;
  }

  if (tipo === "saida" && quantidade > produto.quantidade) {
    porId("mensagemMov").textContent =
      `Saldo insuficiente. Disponível: ${produto.quantidade} unidade(s).`;
    return;
  }

  const saldoAnterior = produto.quantidade;
  const historicoAnterior = historico;

  produto.quantidade += tipo === "entrada" ? quantidade : -quantidade;

  historico = [{
    id: crypto.randomUUID(),
    produtoId: produto.id,
    nome: produto.nome,
    tipo,
    quantidade,
    observacao,
    data: new Date().toISOString()
  }, ...historico];

  if (!salvarDados()) {
    produto.quantidade = saldoAnterior;
    historico = historicoAnterior;
    return;
  }

  porId("formMovimentacao").reset();
  porId("mensagemMov").textContent =
    `Movimentação registrada! Saldo atual: ${produto.quantidade}.`;

  atualizarTela();
});

// Pesquisa de produtos
porId("pesquisa").addEventListener("input", atualizarProdutos);

function atualizarTela() {
  porId("totalProdutos").textContent = produtos.length;

  porId("totalUnidades").textContent = produtos.reduce(
    (total, produto) => total + produto.quantidade, 0
  );

  porId("totalBaixo").textContent = produtos.filter(
    p => p.quantidade > 0 && p.quantidade <= p.minimo
  ).length;

  porId("totalZerado").textContent = produtos.filter(
    p => p.quantidade === 0
  ).length;

  atualizarAlertas();
  atualizarSelecao();
  atualizarProdutos();
  atualizarHistorico();
}

function atualizarAlertas() {
  const lista = porId("alertas");

  const precisam = produtos.filter(
    p => p.quantidade <= p.minimo
  );

  if (precisam.length === 0) {
    lista.innerHTML = '<p class="vazio">Tudo certo! Nenhum produto precisa de reposição.</p>';
    return;
  }

  lista.innerHTML = precisam.map(p => `
    <div class="item">
      <strong>${escapar(p.nome)}</strong>
      <span class="selo ${classeEstado(p)}">${estadoProduto(p)}</span>
      <small>Saldo atual: ${p.quantidade} · Mínimo: ${p.minimo}</small>
      <small>Para voltar ao mínimo: ${Math.max(0, p.minimo - p.quantidade)} unidade(s)</small>
    </div>
  `).join("");
}

function atualizarSelecao() {
  const selecao = porId("produtoMov");
  const valorAnterior = selecao.value;

  selecao.innerHTML =
    '<option value="">Selecione um produto</option>' +
    produtos.map(p =>
      `<option value="${escapar(p.id)}">${escapar(p.nome)} — saldo: ${p.quantidade}</option>`
    ).join("");

  if (produtos.some(p => p.id === valorAnterior)) {
    selecao.value = valorAnterior;
  }
}

function atualizarProdutos() {
  const termo = porId("pesquisa").value.trim().toLowerCase();

  const encontrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(termo) ||
    p.categoria.toLowerCase().includes(termo)
  );

  porId("listaProdutos").innerHTML = encontrados.length
    ? encontrados.map(p => `
      <div class="item">
        <strong>${escapar(p.nome)}</strong>
        <span class="selo ${classeEstado(p)}">${estadoProduto(p)}</span>
        <small>Categoria: ${escapar(p.categoria || "Sem categoria")}</small>
        <small>Saldo: ${p.quantidade} · Estoque mínimo: ${p.minimo}</small>
      </div>
    `).join("")
    : '<p class="vazio">Nenhum produto encontrado.</p>';
}

function atualizarHistorico() {
  const lista = porId("listaHistorico");

  lista.innerHTML = historico.length
    ? historico.map(m => `
      <div class="movimento">
        <strong>${escapar(m.nome)}</strong>
        <span class="selo ${m.tipo === "entrada" ? "verde" : "vermelho"}">
          ${m.tipo === "entrada" ? "ENTRADA" : "SAÍDA"}: ${m.quantidade}
        </span>
        <small>${formatarData(m.data)}</small>
        <small>${escapar(m.observacao || "Sem observação")}</small>
      </div>
    `).join("")
    : '<p class="vazio">Nenhuma movimentação registrada.</p>';
}

// Recupera os dados ao abrir ou recarregar a página
iniciarAutenticacao().catch(erro => {
  porId("mensagemLogin").textContent =
    `Não foi possível iniciar o login: ${erro.message}`;
});
