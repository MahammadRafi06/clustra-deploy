// Clustra fork: render a custom sidebar instead of upstream's flat nav list.
// All Clustra-specific markup lives in ../clustra/ClustraSidebar.tsx so this
// host file stays minimal and resolves cleanly during upstream syncs.
export {SIDEBAR_TOOLS_ID, Sidebar, useSidebarTarget} from '../clustra/ClustraSidebar';
