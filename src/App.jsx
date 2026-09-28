import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import ToolSection from "./components/ToolSection";
import ToolUpload from "./pages/ToolUpload";
import ToolWork from "./pages/ToolWork";

function Home() {
  return (
    <>
      <Navbar />
      <ToolSection />
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route
          path="/tool/:toolId/upload"
          element={<ToolUpload />}
        />

        <Route
          path="/tool/:toolId/work"
          element={<ToolWork />}
        />
      </Routes>
    </BrowserRouter>
  );
}