import { Accessibility, Baby, Briefcase, FileBadge, GraduationCap, HandHeart, HeartPulse, Home, Landmark, Sprout, Store, UserSquare, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  'id-card': UserSquare, 'graduation-cap': GraduationCap, briefcase: Briefcase, 'heart-pulse': HeartPulse, sprout: Sprout, baby: Baby,
  'hand-heart': HandHeart, store: Store, landmark: Landmark, home: Home, 'file-badge': FileBadge, accessibility: Accessibility,
};
export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Landmark;
}
