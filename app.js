// Configuração Firebase - Cole suas chaves aqui
const firebaseConfig = {
  apiKey: "AIzaSyAVxYqrd4KUNsZwDQiy1MvU7WzTaU9JFEo",
  authDomain: "mvp-clinica-pendenciaa.firebaseapp.com",
  databaseURL: "https://mvp-clinica-pendenciaa-default-rtdb.firebaseio.com",
  projectId: "mvp-clinica-pendenciaa",
  storageBucket: "mvp-clinica-pendenciaa.firebasestorage.app",
  messagingSenderId: "1048678816555",
  appId: "1:1048678816555:web:441e3f0d2cecfa9287836e",
};

// Inicializar Firebase
function initFirebase() {
  firebase.initializeApp(firebaseConfig);
  return {
    auth: firebase.auth(),
    db: firebase.database(),
  };
}

const { auth, db } = initFirebase();

// Verificar rota (guard)
function guardRoute() {
  auth.onAuthStateChanged((user) => {
    if (window.location.pathname.includes("index.html")) {
      if (!user) {
        window.location.href = "login.html";
      } else {
        document.getElementById("userEmail").textContent =
          `Logado como: ${user.email}`;
        renderPendencias();
      }
    } else if (window.location.pathname.includes("login.html")) {
      if (user) {
        window.location.href = "index.html";
      }
    }
  });
}

// Login
function login(email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}

// Registro
function register(email, password) {
  return auth.createUserWithEmailAndPassword(email, password);
}

// Logout
function logout() {
  auth.signOut().then(() => {
    window.location.href = "login.html";
  });
}

// Calcular dias em aberto
function calcDias(dataVisita) {
  const hoje = new Date();
  const visita = new Date(dataVisita);
  const diffTime = Math.abs(hoje - visita);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays - 1; // Hoje conta como 0
}

// Escape HTML
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Máscara telefone
function maskPhone(input) {
  let value = input.value.replace(/\D/g, "");
  if (value.length <= 11) {
    value = value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  input.value = value;
}

// Adicionar pendência
function addPendencia(
  pacienteNome,
  pacienteTelefone,
  dataVisita,
  convenio,
  numeroCarteira,
  responsavelPendencia,
  pendenciaTexto,
) {
  const user = auth.currentUser;
  if (!user) return;

  const pendencia = {
    paciente_nome: pacienteNome,
    paciente_telefone: pacienteTelefone,
    data_visita: dataVisita,
    convenio: convenio || "",
    numero_carteira: numeroCarteira || "",
    responsavel_pendencia: responsavelPendencia,
    pendencia_texto: pendenciaTexto,
    status: "PENDENTE",
    criado_em: firebase.database.ServerValue.TIMESTAMP,
    resolvido_em: null,
  };

  return db.ref("pendencias").push(pendencia);
}

// Renderizar pendências
function renderPendencias(filter = "pendentes", search = "") {
  const pendenciasRef = db.ref("pendencias");
  pendenciasRef.on("value", (snapshot) => {
    const pendencias = snapshot.val() || {};
    const pendenciasArray = Object.keys(pendencias).map((id) => ({
      id,
      ...pendencias[id],
    }));

    // Filtrar por status
    let filtered = pendenciasArray;
    if (filter === "pendentes") {
      filtered = pendenciasArray.filter((p) => p.status === "PENDENTE");
    } else if (filter === "resolvidas") {
      filtered = pendenciasArray.filter((p) => p.status === "RESOLVIDA");
    }

    // Busca
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.paciente_nome.toLowerCase().includes(searchLower) ||
          p.paciente_telefone.includes(search),
      );
    }

    // Ordenar por mais antigas primeiro
    filtered.sort((a, b) => {
      const diasA = calcDias(a.data_visita);
      const diasB = calcDias(b.data_visita);
      return diasB - diasA;
    });

    // Renderizar tabela
    const tbody = document.getElementById("pendenciasBody");
    tbody.innerHTML = "";

    let totalPendentes = 0;
    let totalResolvidas = 0;

    filtered.forEach((p) => {
      if (p.status === "PENDENTE") totalPendentes++;
      else totalResolvidas++;

      const dias = calcDias(p.data_visita);
      const rowClass =
        dias > 15 ? "atraso-alto" : dias > 7 ? "atraso-medio" : "";
      const whatsappLink = `https://wa.me/55${p.paciente_telefone.replace(/\D/g, "")}`;

      const row = `
                <tr class="${rowClass}">
                    <td>${escapeHTML(p.paciente_nome)}</td>
                    <td><a href="${whatsappLink}" class="whatsapp-link" target="_blank">${escapeHTML(p.paciente_telefone)}</a></td>
                    <td>${new Date(p.data_visita).toLocaleDateString("pt-BR")}</td>
                    <td>${escapeHTML(p.convenio || "-")}</td>
                    <td>${escapeHTML(p.numero_carteira || "-")}</td>
                    <td>${escapeHTML(p.pendencia_texto)}</td>
                    <td>${escapeHTML(p.responsavel_pendencia || "-")}</td>
                    <td>${dias}</td>
                    <td><input type="checkbox" class="checkbox" ${p.status === "RESOLVIDA" ? "checked" : ""} onchange="toggleStatus('${p.id}')"></td>
                    <td><button class="delete-btn" onclick="deletePendencia('${p.id}')">Excluir</button></td>
                </tr>
            `;
      tbody.innerHTML += row;
    });

    document.getElementById("totalPendentes").textContent = totalPendentes;
    document.getElementById("totalResolvidas").textContent = totalResolvidas;
  });
}

// Toggle status
function toggleStatus(id) {
  const pendenciaRef = db.ref(`pendencias/${id}`);
  pendenciaRef.once("value", (snapshot) => {
    const pendencia = snapshot.val();
    const newStatus =
      pendencia.status === "PENDENTE" ? "RESOLVIDA" : "PENDENTE";
    const update = {
      status: newStatus,
      resolvido_em:
        newStatus === "RESOLVIDA"
          ? firebase.database.ServerValue.TIMESTAMP
          : null,
    };
    pendenciaRef.update(update);
  });
}

// Deletar pendência
function deletePendencia(id) {
  if (confirm("Tem certeza que deseja excluir esta pendência?")) {
    db.ref(`pendencias/${id}`).remove();
  }
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  guardRoute();

  // Login form
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      login(email, password).catch((error) => {
        document.getElementById("errorMessage").textContent = error.message;
      });
    });

    document.getElementById("registerBtn").addEventListener("click", () => {
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      register(email, password).catch((error) => {
        document.getElementById("errorMessage").textContent = error.message;
      });
    });
  }

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  // Pendencia form
  const pendenciaForm = document.getElementById("pendenciaForm");
  if (pendenciaForm) {
    pendenciaForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pacienteNome = document.getElementById("pacienteNome").value;
      const pacienteTelefone =
        document.getElementById("pacienteTelefone").value;
      const dataVisita = document.getElementById("dataVisita").value;
      const convenio = document.getElementById("convenio").value;
      const numeroCarteira = document.getElementById("numeroCarteira").value;
      const responsavelPendencia = document.getElementById(
        "responsavelPendencia",
      ).value;
      const pendenciaTexto = document.getElementById("pendenciaTexto").value;

      addPendencia(
        pacienteNome,
        pacienteTelefone,
        dataVisita,
        convenio,
        numeroCarteira,
        responsavelPendencia,
        pendenciaTexto,
      ).then(() => {
        pendenciaForm.reset();
      });
    });

    // Máscara telefone
    document
      .getElementById("pacienteTelefone")
      .addEventListener("input", (e) => maskPhone(e.target));
  }

  // Filtros
  const filterPendentes = document.getElementById("filterPendentes");
  const filterResolvidas = document.getElementById("filterResolvidas");
  const searchInput = document.getElementById("searchInput");

  if (filterPendentes && filterResolvidas && searchInput) {
    filterPendentes.addEventListener("click", () => {
      filterPendentes.classList.add("active");
      filterResolvidas.classList.remove("active");
      renderPendencias("pendentes", searchInput.value);
    });

    filterResolvidas.addEventListener("click", () => {
      filterResolvidas.classList.add("active");
      filterPendentes.classList.remove("active");
      renderPendencias("resolvidas", searchInput.value);
    });

    searchInput.addEventListener("input", () => {
      const filter = filterPendentes.classList.contains("active")
        ? "pendentes"
        : "resolvidas";
      renderPendencias(filter, searchInput.value);
    });
  }
});
