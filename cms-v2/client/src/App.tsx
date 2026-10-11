import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { canManageContent, getCurrentUser, getToken } from './api/client';
import Layout from './components/Layout';
import Dashboard from './screens/Dashboard';
import Login from './screens/Login';
import ResetPassword from './screens/ResetPassword';
import HomeHero from './screens/HomeHero';
import AboutUs from './screens/AboutUs';
import Header from './screens/Header';
import BlogHeader from './screens/BlogHeader';
import Footer from './screens/Footer';
import Banner from './screens/Banner';
import CoursePrice from './screens/CoursePrice';
import PaymentCards from './screens/PaymentCards';
import PromotionSection from './screens/PromotionSection';
import ContactFooter from './screens/ContactFooter';
import CourseHero from './screens/CourseHero';
import CourseHeroRight from './screens/CourseHeroRight';
import CourseDesc from './screens/CourseDesc';
import CourseTabs from './screens/CourseTabs';
import CourseFinder from './screens/CourseFinder';
import CourseFinderBanner from './screens/CourseFinderBanner';
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
import SettingsPage from './screens/Settings/Page';
import Configurations from './screens/Configurations';
import Sales from './screens/Sales';
import Students from './screens/Students';
import GoogleConversions from './screens/GoogleConversions';
import ContentMigrationPage from './screens/ContentMigration/Page';
import CoursesPage from './screens/Courses/Page';
import AcceptSale from './screens/AcceptSale';
import ExamResult from './screens/ExamResult';
import Forms from './screens/Forms';
import FAQ from './screens/FAQ';
import Events from './screens/Events';
import Articles from './screens/Articles';
import Blog from './screens/Blog';
import BppBooks from './screens/BppBooks';
import BookAMeeting from './screens/BookAMeeting';
import FullScreenSections from './screens/FullScreenSections';
import SplitScreenSections from './screens/SplitScreenSections';
import VerticalCards from './screens/VerticalCards';
import GradientBannerSection from './screens/GradientBannerSection';
import PageDescWithMenu from './screens/PageDescWithMenu';


function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

function vaultHome(): string {
  return canManageContent(getCurrentUser()?.role)
    ? '/content-migration'
    : '/content-migration?tab=global';
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  return getCurrentUser()?.role === 'admin' ? <>{children}</> : <Navigate to={vaultHome()} replace />;
}

function VaultHome() {
  return <Navigate to={vaultHome()} replace />;
}

function LegacyContentRedirect() {
  const [params] = useSearchParams();
  const tab = params.get('tab');
  if (tab === 'books') return <Navigate to="/content-migration?tab=books" replace />;
  if (tab === 'courses') return <Navigate to="/courses" replace />;
  return <Navigate to="/content-migration" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-sale" element={<AcceptSale />} />
        <Route path="/exam-result" element={<ExamResult />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<VaultHome />} />
          <Route path="/dashboard"         element={<Dashboard />} />
          <Route path="/header"            element={<Header />} />
          <Route path="/header-v2"         element={<Navigate to="/content-migration?tab=global" replace />} />
          <Route path="/blog-header"       element={<BlogHeader />} />
          <Route path="/footer"            element={<Footer />} />
          <Route path="/footer-v2"         element={<Navigate to="/content-migration?tab=global&global=footer" replace />} />
          <Route path="/banner"            element={<Banner />} />
          <Route path="/course-price"      element={<RequireAdmin><CoursePrice /></RequireAdmin>} />
          <Route path="/course-pricing"    element={<Navigate to="/courses?tab=prices" replace />} />
          <Route path="/payment-cards"     element={<PaymentCards />} />
          <Route path="/promotion-section" element={<PromotionSection />} />
          <Route path="/contact-footer"    element={<ContactFooter />} />
          <Route path="/home-hero"         element={<HomeHero />} />
          <Route path="/about-us"          element={<AboutUs />} />
          <Route path="/course-hero"       element={<CourseHero />} />
          <Route path="/course-hero-right" element={<CourseHeroRight />} />
          <Route path="/course-desc"       element={<CourseDesc />} />
          <Route path="/course-tabs"       element={<CourseTabs />} />
          <Route path="/course-finder"     element={<CourseFinder />} />
          <Route path="/course-finder-banner" element={<CourseFinderBanner />} />
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
          <Route path="/bpp-books"             element={<BppBooks />} />
          <Route path="/discount-codes"        element={<Navigate to="/content-migration?tab=books&booksTab=discounts" replace />} />
          <Route path="/book-a-meeting"        element={<BookAMeeting />} />
          <Route path="/full-screen/:type"     element={<FullScreenSections />} />
          <Route path="/split-screen/:type"    element={<SplitScreenSections />} />
          <Route path="/page-desc-with-menu"  element={<PageDescWithMenu />} />
          <Route path="/split-screen-sections" element={<Navigate to="/split-screen/left-hero" replace />} />
          <Route path="/blog-migration"    element={<Navigate to="/content-migration" replace />} />
          <Route path="/books"             element={<Navigate to="/content-migration?tab=books" replace />} />
          <Route path="/courses"           element={<RequireAdmin><CoursesPage /></RequireAdmin>} />
          <Route path="/prices-configuration" element={<Navigate to="/courses?tab=configuration" replace />} />
          <Route path="/settings"          element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
          <Route path="/settings/logs"     element={<Navigate to="/settings?tab=logs" replace />} />
          <Route path="/settings/cache"    element={<Navigate to="/settings?tab=cache" replace />} />
          <Route path="/settings/sitemap"  element={<Navigate to="/settings?tab=sitemap" replace />} />
          <Route path="/settings/users"    element={<Navigate to="/settings?tab=users" replace />} />
          <Route path="/settings/menu"     element={<Navigate to="/settings?tab=logs" replace />} />
          <Route path="/content-management" element={<LegacyContentRedirect />} />
          <Route path="/content-migration" element={<ContentMigrationPage />} />
          <Route path="/configurations"   element={<RequireAdmin><Configurations /></RequireAdmin>} />
          <Route path="/sales/payments"   element={<Navigate to="/sales?tab=payments" replace />} />
          <Route path="/sales"            element={<RequireAdmin><Sales /></RequireAdmin>} />
          <Route path="/students"         element={<RequireAdmin><Students /></RequireAdmin>} />
          <Route path="/google-conversions" element={<RequireAdmin><GoogleConversions /></RequireAdmin>} />
          <Route path="/billing/custom-offer" element={<Navigate to="/sales?tab=custom-offer" replace />} />
          <Route path="/billing/offers"       element={<Navigate to="/sales?tab=transactions" replace />} />
          <Route path="/settings/courses" element={<Navigate to="/courses" replace />} />
          <Route path="/settings/tutors"  element={<Navigate to="/configurations" replace />} />
          <Route path="/settings/sales"   element={<Navigate to="/sales" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
