import { NavLink, Route, Routes } from "react-router-dom";
import { Upload, List, Mic, HardDrive } from "lucide-react";
import { UploadPage } from "./pages/UploadPage";
import { JobsPage } from "./pages/JobsPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { ModelsPage } from "./pages/ModelsPage";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
    isActive
      ? "bg-gray-800 text-cyan-400"
      : "text-gray-400 hover:text-gray-200"
  }`;
}

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-bold text-cyan-400 tracking-tight">
            <Mic size={20} />
            Transcriptor
          </NavLink>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navLinkClass}>
              <Upload size={14} />
              Upload
            </NavLink>
            <NavLink to="/jobs" className={navLinkClass}>
              <List size={14} />
              Jobs
            </NavLink>
            <NavLink to="/models" className={navLinkClass}>
              <HardDrive size={14} />
              Models
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/models" element={<ModelsPage />} />
        </Routes>
      </main>
    </div>
  );
}
