import { z } from 'zod';
export type Role = 'OWNER' | 'BARBER' | 'CLIENT';
export type Plan = 'FREE' | 'PRO' | 'PREMIUM';
export const roleHome = (role: Role) => '/' + role.toLowerCase();
export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const bookingSchema = z.object({ serviceId: z.uuid(), barberId: z.uuid(), clientId: z.uuid(), startsAt: z.iso.datetime({ offset: true }), useSubscription: z.boolean().default(false) }).strict();
export const assistantSchema = z.object({ message: z.string().trim().min(1).max(2000), conversationId: z.uuid().optional() }).strict();
export const actionSchema = z.object({ type: z.enum(['open_schedule', 'open_subscription', 'open_clients', 'open_report']), label: z.string().max(80) }).strict();
export const allowedActions: Record<Role, string[]> = { OWNER: ['open_schedule', 'open_clients', 'open_report'], BARBER: ['open_schedule'], CLIENT: ['open_schedule', 'open_subscription'] };
export const suggestions: Record<Role, string[]> = {
 OWNER: ['Quanto faturei esta semana?', 'Tenho horários vazios amanhã?', 'Qual serviço vende mais?'],
 BARBER: ['Quem é meu próximo cliente?', 'Quantos atendimentos tenho hoje?', 'Qual meu horário livre amanhã?'],
 CLIENT: ['Quando é meu próximo corte?', 'Quantos cortes tenho no plano?', 'Quais serviços estão disponíveis?']
};
export interface Membership { barbershop_id: string; user_id: string; role: Role; display_name: string; phone?: string|null; active: boolean }
export interface Shop { id: string; name: string; slug: string; timezone: string; public_title?:string|null; public_description?:string|null; logo_url?:string|null; cover_url?:string|null; background_url?:string|null; accent_color?:string|null }
export interface Service { id: string; name: string; duration_minutes: number; price_cents: number; active: boolean }
export type AppointmentStatus = 'scheduled'|'confirmed'|'in_service'|'completed'|'cancelled'|'no_show';
export interface Appointment { id: string; client_id: string; barber_id: string; service_id: string; starts_at: string; ends_at: string; status: AppointmentStatus; price_cents: number; subscription_id?:string|null; payment_method?:'pending'|'cash'|'pix'|'card'|'subscription'|'other' }
export interface Customer { id: string; name: string; phone?: string|null; user_id: string|null }
export interface Subscription { id: string; client_id?:string; plan_id?:string|null; name: string; remaining_cuts: number; initial_cuts?:number; price_cents?:number; expires_at: string; status: string }
export interface SubscriptionPlan { id:string; name:string; cuts:number; validity_days:number; price_cents:number; active:boolean }
export interface Payment { appointment_id:string; amount_cents:number; created_at:string }
export interface Campaign { id:string; title:string; body:string; audience:'CLIENT'|'BARBER'|'ALL'; status:'draft'|'published'|'archived'; created_at:string; published_at?:string|null }
export interface Notification { id:string; title:string; body:string; read_at?:string|null; created_at:string }
export interface FeedPost { id: string; author_id: string; author_name: string; caption: string; image_path: string; created_at: string }
export interface Review { id:string; appointment_id:string; client_id:string; barber_id:string; rating:number; comment?:string|null; created_at:string }
export interface Bootstrap { shop: Shop; membership: Membership; memberships: Membership[]; services: Service[]; appointments: Appointment[]; customers: Customer[]; team: Membership[]; subscriptions: Subscription[]; subscriptionPlans: SubscriptionPlan[]; payments: Payment[]; campaigns: Campaign[]; notifications: Notification[]; posts: FeedPost[]; reviews: Review[]; plan: Plan; aiEnabled:boolean; revenue: number|null }
