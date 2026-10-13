"use client";

import { createContext, useContext } from "react";

export type SiteProfile = {
  companyName: string; name: string; professionalTitle: string; location: string;
  email: string; businessEmail: string; phone: string; photoUrl: string | null;
  socialLinks: Array<{ platform: string; label: string; url: string }>;
};

const SiteData = createContext<SiteProfile | null>(null);

export function SiteDataProvider({ profile, children }: { profile: SiteProfile; children: React.ReactNode }) {
  return <SiteData.Provider value={profile}>{children}</SiteData.Provider>;
}

export function useSiteProfile() {
  const profile = useContext(SiteData);
  if (!profile) throw new Error("Site profile is unavailable.");
  return profile;
}