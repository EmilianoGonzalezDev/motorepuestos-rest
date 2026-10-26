import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  ArrowLeft, ArrowRight, ArrowUpDown, Ban, Bike, Bold, Boxes, CalendarDays, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, CircleCheck, CircleUser, CircleX, ClipboardList, Clock, CreditCard, Database, Download,
  Eye, EyeOff, Funnel, Gauge, Headset, Heading3, Heart, House, ImageOff, Inbox, Info, Italic, Landmark,
  LayoutDashboard, Link2, List, ListOrdered, Lock, LogIn, LogOut, LucideAngularModule, LucideIconData, Mail, MapPin,
  Menu, Minus, Moon, Package, PackageCheck, PackageX, Pencil, Phone, Plus, Power, Receipt, RefreshCw, Save, Search,
  Settings, ShieldCheck, ShoppingBag, ShoppingCart, SlidersHorizontal, Sparkles, Star, Store, Sun, Tags, Trash2,
  TrendingDown, TrendingUp, TriangleAlert, Truck, Underline, Upload, User, UserCog, UserPlus, Users, Wallet, Wrench,
  X, Zap,
} from 'lucide-angular';

/** Explicit registry: only these icons end up in the bundle. */
const ICONS = {
  'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, 'arrow-up-down': ArrowUpDown, ban: Ban, bike: Bike, bold: Bold,
  boxes: Boxes, calendar: CalendarDays, check: Check, 'chevron-down': ChevronDown, 'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight, 'circle-alert': CircleAlert, 'circle-check': CircleCheck, 'circle-user': CircleUser,
  'circle-x': CircleX, clipboard: ClipboardList, clock: Clock, 'credit-card': CreditCard, database: Database,
  download: Download, eye: Eye, 'eye-off': EyeOff, filter: Funnel, gauge: Gauge, headset: Headset, h3: Heading3,
  heart: Heart, home: House, 'image-off': ImageOff, inbox: Inbox, info: Info, italic: Italic, bank: Landmark,
  dashboard: LayoutDashboard, link: Link2, list: List, 'list-ordered': ListOrdered, lock: Lock, 'log-in': LogIn,
  'log-out': LogOut, mail: Mail, 'map-pin': MapPin, menu: Menu, minus: Minus, moon: Moon, package: Package,
  'package-check': PackageCheck, 'package-x': PackageX, pencil: Pencil, phone: Phone, plus: Plus, power: Power,
  receipt: Receipt, refresh: RefreshCw, save: Save, search: Search, settings: Settings, shield: ShieldCheck,
  bag: ShoppingBag, cart: ShoppingCart, sliders: SlidersHorizontal, sparkles: Sparkles, star: Star, store: Store,
  sun: Sun, tags: Tags, trash: Trash2, 'trending-down': TrendingDown, 'trending-up': TrendingUp,
  alert: TriangleAlert, truck: Truck, underline: Underline, upload: Upload, user: User, 'user-cog': UserCog,
  'user-plus': UserPlus, users: Users, wallet: Wallet, wrench: Wrench, x: X, zap: Zap,
} satisfies Record<string, LucideIconData>;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `<lucide-icon [img]="data()" [size]="size()" [strokeWidth]="strokeWidth()" />`,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly strokeWidth = input(2);
  protected readonly data = computed(() => ICONS[this.name()]);
}
