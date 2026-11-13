import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
<<<<<<< HEAD
import App from "./app/App";
import { AuthProvider } from "./hooks/useAuth";
import { ToastProvider } from "./hooks/useToast";
=======
import App from "./App";
>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a
import "leaflet/dist/leaflet.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
<<<<<<< HEAD
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
=======
      <App />
    </BrowserRouter>
  </React.StrictMode>
>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a
);
