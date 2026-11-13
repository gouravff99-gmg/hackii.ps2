import { Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Placeholder from "./pages/Placeholder";

/** Route table only. Real screens live in src/pages. */
export default function App() {
  return (
    <div className="min-h-full bg-slate-50">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/passenger" element={<Placeholder title="Passenger" />} />
        <Route path="/driver" element={<Placeholder title="Driver" />} />
        <Route path="/admin" element={<Placeholder title="Admin" />} />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Routes>
    </div>
  );
}
