import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api/client';
import Layout from './components/Layout';
import Login from './screens/Login';
import HomeHero from './screens/HomeHero';
import AboutUs from './screens/AboutUs';
import Header from './screens/Header';
import Footer from './screens/Footer';
import Banner from './screens/Banner';
import PromotionSection from './screens/PromotionSection';
import ContactFooter from './screens/ContactFooter';
import CourseHero from './screens/CourseHero';
import CourseHeroRight from './screens/CourseHeroRight';
import CourseDesc from './screens/CourseDesc';
import CourseTabs from './screens/CourseTabs';
import HeroSectionV2 from './screens/HeroSectionV2';
import ProgramCards from './screens/ProgramCards';
import ProgramCardsV2 from './screens/ProgramCardsV2';
import FeatureCards from './screens/FeatureCards';
import FeatureCardsV2 from './screens/FeatureCardsV2';
import FeatureCardsV3 from './screens/FeatureCardsV3';

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/header" replace />} />
          <Route path="/header"            element={<Header />} />
          <Route path="/footer"            element={<Footer />} />
          <Route path="/banner"            element={<Banner />} />
          <Route path="/promotion-section" element={<PromotionSection />} />
          <Route path="/contact-footer"    element={<ContactFooter />} />
          <Route path="/home-hero"         element={<HomeHero />} />
          <Route path="/about-us"          element={<AboutUs />} />
          <Route path="/course-hero"       element={<CourseHero />} />
          <Route path="/course-hero-right" element={<CourseHeroRight />} />
          <Route path="/course-desc"       element={<CourseDesc />} />
          <Route path="/course-tabs"       element={<CourseTabs />} />
          <Route path="/hero-section-v2"   element={<HeroSectionV2 />} />
          <Route path="/program-cards"    element={<ProgramCards />} />
          <Route path="/program-cards-v2" element={<ProgramCardsV2 />} />
          <Route path="/feature-cards"    element={<FeatureCards />} />
          <Route path="/feature-cards-v2" element={<FeatureCardsV2 />} />
          <Route path="/feature-cards-v3" element={<FeatureCardsV3 />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
