import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, RequireAuth, RequireAdmin } from "./auth";
import { initTema } from "./lib/theme";
import Entrada from "./pages/Entrada";
import Vitrine from "./pages/Vitrine";
import VitrineImovel from "./pages/VitrineImovel";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import Painel from "./pages/Painel";
import Imoveis from "./pages/Imoveis";
import Corretores from "./pages/Corretores";
import Perfil from "./pages/Perfil";
import "./styles.css";

initTema();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Entrada />} />
          <Route path="/anuncios" element={<Vitrine />} />
          <Route path="/imovel/:id" element={<VitrineImovel />} />
          <Route path="/anunciar" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <Painel />
              </RequireAuth>
            }
          />
          <Route
            path="/imoveis"
            element={
              <RequireAuth>
                <Imoveis />
              </RequireAuth>
            }
          />
          <Route
            path="/perfil"
            element={
              <RequireAuth>
                <Perfil />
              </RequireAuth>
            }
          />
          <Route
            path="/corretores"
            element={
              <RequireAdmin>
                <Corretores />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
