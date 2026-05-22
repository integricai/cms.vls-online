import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getCurrentUser, getToken } from './api/client';
import Layout from './components/Layout';
import Login from './screens/Login';
import ResetPassword from './screens/ResetPassword';
import HomeHero from './screens/HomeHero';
import AboutUs from './screens/AboutUs';
import Header from './screens/Header';
import BlogHeader from './screens/BlogHeader';
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
import FeatureCardsV4 from './screens/FeatureCardsV4';
import StepCards from './screens/StepCards';
import LegalPage from './screens/LegalPage';
import Team from './screens/Team';
import UserManagement from './screens/UserManagement';
import MenuManagement from './screens/MenuManagement';
import Forms from './screens/Forms';
import FAQ from './screens/FAQ';
import Events from './screens/Events';
import Articles from './screens/Articles';
import Blog from './screens/Blog';
import FullScreenSections from './screens/FullScreenSections';
import SplitScreenSections from './screens/SplitScreenSections';
import VerticalCards from './screens/VerticalCards';
import GradientBannerSection from './screens/GradientBannerSection';
import PageDescWithMenu from './screens/PageDescWithMenu';

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  return getCurrentUser()?.role === 'admin' ? <>{children}</> : <Navigate to="/home-hero" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/header" replace />} />
          <Route path="/header"            element={<Header />} />
          <Route path="/blog-header"       element={<BlogHeader />} />
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
          <Route path="/feature-cards-v4" element={<FeatureCardsV4 />} />
          <Route path="/step-cards"       element={<StepCards />} />
          <Route path="/vertical-cards"   element={<VerticalCards />} />
          <Route path="/gradient-banner-section" element={<GradientBannerSection />} />
          <Route path="/legal-page"       element={<LegalPage />} />
          <Route path="/team"             element={<Team />} />
          <Route path="/faq"                   element={<FAQ />} />
          <Route path="/forms/:type"           element={<Forms />} />
          <Route path="/events"                element={<Events />} />
          <Route path="/articles"              element={<Articles />} />
          <Route path="/blog"                  element={<Blog />} />
          <Route path="/full-screen/:type"     element={<FullScreenSections />} />
          <Route path="/split-screen/:type"    element={<SplitScreenSections />} />
          <Route path="/page-desc-with-menu"  element={<PageDescWithMenu />} />
          <Route path="/split-screen-sections" element={<Navigate to="/split-screen/left-hero" replace />} />
          <Route path="/settings/users"   element={<RequireAdmin><UserManagement /></RequireAdmin>} />
          <Route path="/settings/menu"    element={<RequireAdmin><MenuManagement /></RequireAdmin>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
