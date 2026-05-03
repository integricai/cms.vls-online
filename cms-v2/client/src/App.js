import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getCurrentUser, getToken } from './api/client';
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
import StepCards from './screens/StepCards';
import LegalPage from './screens/LegalPage';
import Team from './screens/Team';
import UserManagement from './screens/UserManagement';
import FAQ from './screens/FAQ';
import Events from './screens/Events';
import Articles from './screens/Articles';
import FullScreenSections from './screens/FullScreenSections';
import SplitScreenSections from './screens/SplitScreenSections';
function RequireAuth({ children }) {
    return getToken() ? _jsx(_Fragment, { children: children }) : _jsx(Navigate, { to: "/login", replace: true });
}
function RequireAdmin({ children }) {
    return getCurrentUser()?.role === 'admin' ? _jsx(_Fragment, { children: children }) : _jsx(Navigate, { to: "/home-hero", replace: true });
}
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsxs(Route, { element: _jsx(RequireAuth, { children: _jsx(Layout, {}) }), children: [_jsx(Route, { index: true, element: _jsx(Navigate, { to: "/header", replace: true }) }), _jsx(Route, { path: "/header", element: _jsx(Header, {}) }), _jsx(Route, { path: "/footer", element: _jsx(Footer, {}) }), _jsx(Route, { path: "/banner", element: _jsx(Banner, {}) }), _jsx(Route, { path: "/promotion-section", element: _jsx(PromotionSection, {}) }), _jsx(Route, { path: "/contact-footer", element: _jsx(ContactFooter, {}) }), _jsx(Route, { path: "/home-hero", element: _jsx(HomeHero, {}) }), _jsx(Route, { path: "/about-us", element: _jsx(AboutUs, {}) }), _jsx(Route, { path: "/course-hero", element: _jsx(CourseHero, {}) }), _jsx(Route, { path: "/course-hero-right", element: _jsx(CourseHeroRight, {}) }), _jsx(Route, { path: "/course-desc", element: _jsx(CourseDesc, {}) }), _jsx(Route, { path: "/course-tabs", element: _jsx(CourseTabs, {}) }), _jsx(Route, { path: "/hero-section-v2", element: _jsx(HeroSectionV2, {}) }), _jsx(Route, { path: "/program-cards", element: _jsx(ProgramCards, {}) }), _jsx(Route, { path: "/program-cards-v2", element: _jsx(ProgramCardsV2, {}) }), _jsx(Route, { path: "/feature-cards", element: _jsx(FeatureCards, {}) }), _jsx(Route, { path: "/feature-cards-v2", element: _jsx(FeatureCardsV2, {}) }), _jsx(Route, { path: "/feature-cards-v3", element: _jsx(FeatureCardsV3, {}) }), _jsx(Route, { path: "/step-cards", element: _jsx(StepCards, {}) }), _jsx(Route, { path: "/legal-page", element: _jsx(LegalPage, {}) }), _jsx(Route, { path: "/team", element: _jsx(Team, {}) }), _jsx(Route, { path: "/faq", element: _jsx(FAQ, {}) }), _jsx(Route, { path: "/events", element: _jsx(Events, {}) }), _jsx(Route, { path: "/articles", element: _jsx(Articles, {}) }), _jsx(Route, { path: "/full-screen/:type", element: _jsx(FullScreenSections, {}) }), _jsx(Route, { path: "/split-screen/:type", element: _jsx(SplitScreenSections, {}) }), _jsx(Route, { path: "/split-screen-sections", element: _jsx(Navigate, { to: "/split-screen/left-hero", replace: true }) }), _jsx(Route, { path: "/settings/users", element: _jsx(RequireAdmin, { children: _jsx(UserManagement, {}) }) })] })] }) }));
}
