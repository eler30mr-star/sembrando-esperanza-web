import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Plans from './pages/Plans.jsx';
import PlanDetail from './pages/PlanDetail.jsx';
import Stories from './pages/Stories.jsx';
import StoryDetail from './pages/StoryDetail.jsx';
import Verses from './pages/Verses.jsx';
import Gallery from './pages/Gallery.jsx';
import Videos from './pages/Videos.jsx';
import Prayer from './pages/Prayer.jsx';
import AppPage from './pages/AppPage.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/planes" element={<Plans />} />
        <Route path="/planes/:slug" element={<PlanDetail />} />
        <Route path="/historias" element={<Stories />} />
        <Route path="/historias/:slug" element={<StoryDetail />} />
        <Route path="/versiculos" element={<Verses />} />
        <Route path="/imagenes" element={<Gallery />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/oracion" element={<Prayer />} />
        <Route path="/app" element={<AppPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
