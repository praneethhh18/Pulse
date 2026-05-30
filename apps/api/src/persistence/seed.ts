import { randomUUID } from 'crypto';
import { hashEmbed } from '../llm/embeddings';
import type {
  CalendarEventDoc,
  DocumentDoc,
  EmailDoc,
  HealthRecordDoc,
  PersonDoc,
  UserDoc,
} from '../domain/types';

// Demo data that makes Pulse look alive on first launch — and gives the
// Context Engine real cross-domain signals to connect.

function iso(d: Date): string {
  return d.toISOString();
}
function daysFromNow(n: number, h = 9, m = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(h, m, 0, 0);
  return d;
}
function base(userId: string) {
  const now = iso(new Date());
  return { _id: randomUUID(), userId, createdAt: now, updatedAt: now };
}

function doc(
  userId: string,
  title: string,
  category: DocumentDoc['category'],
  content: string,
  tags: string[],
  expiresAt?: string,
): DocumentDoc {
  return {
    ...base(userId),
    title,
    category,
    content,
    tags,
    expiresAt,
    embedding: hashEmbed(`${title} ${content} ${tags.join(' ')}`),
  };
}

export interface SeedData {
  users: UserDoc[];
  documents: DocumentDoc[];
  email_intelligence: EmailDoc[];
  calendar_events: CalendarEventDoc[];
  health_records: HealthRecordDoc[];
  relationship_memory: PersonDoc[];
}

function health(
  userId: string,
  kind: HealthRecordDoc['kind'],
  name: string,
  value: string | undefined,
  unit: string | undefined,
  daysAgo: number,
  notes?: string,
): HealthRecordDoc {
  return {
    ...base(userId),
    kind,
    name,
    value,
    unit,
    notedAt: iso(daysFromNow(-daysAgo, 9, 0)),
    notes,
  };
}

export function buildSeed(userId: string): SeedData {
  const user: UserDoc = {
    ...base(userId),
    name: 'Alex',
    email: 'alex@pulse.app',
    preferences: { quietHoursStart: 23, quietHoursEnd: 7, timezone: 'Asia/Kolkata' },
    learnedPatterns: {},
    consentLedger: [
      { source: 'email', grantedAt: iso(new Date()) },
      { source: 'documents', grantedAt: iso(new Date()) },
      { source: 'calendar', grantedAt: iso(new Date()) },
    ],
  };

  const documents: DocumentDoc[] = [
    doc(
      userId,
      'Passport',
      'identity',
      'Republic of India passport. Holder: Khadar. Passport number Z1234567. Place of issue Bengaluru.',
      ['passport', 'identity', 'travel', 'india'],
      iso(daysFromNow(45)), // expiring soon → triggers expiry nudge
    ),
    doc(
      userId,
      'Health Insurance Policy',
      'medical',
      'Star Health comprehensive policy. Sum insured 10 lakh. Covers hospitalisation, surgery, annual checkup. Cashless network hospitals included.',
      ['insurance', 'health', 'medical', 'policy'],
      iso(daysFromNow(120)),
    ),
    doc(
      userId,
      'Rental Agreement',
      'legal',
      'Lease agreement for apartment in Bengaluru. Monthly rent 28000. Security deposit 100000. Lock-in period 11 months. Notice period two months.',
      ['rent', 'lease', 'legal', 'housing', 'agreement'],
    ),
    doc(
      userId,
      'Degree Certificate',
      'educational',
      'Bachelor of Engineering, Computer Science. Visvesvaraya Technological University. First class with distinction.',
      ['degree', 'education', 'certificate', 'engineering'],
    ),
    doc(
      userId,
      'Car Insurance',
      'vehicle',
      'Comprehensive motor insurance for Hyundai i20. Covers own damage and third party. IDV 600000.',
      ['car', 'vehicle', 'insurance', 'motor'],
      iso(daysFromNow(18)),
    ),
    doc(
      userId,
      'Latest Blood Report',
      'medical',
      'Complete blood count and lipid profile. Haemoglobin 14.2. Vitamin D low at 18. Cholesterol borderline. Advised vitamin D supplements and recheck in 3 months.',
      ['blood', 'report', 'health', 'lab', 'vitamin d'],
    ),
  ];

  const email_intelligence: EmailDoc[] = [
    {
      ...base(userId),
      from: 'no-reply@hdfcbank.net',
      subject: 'Action required: complete KYC to avoid account suspension',
      body: 'Dear customer, your account KYC is pending. Please complete verification within 3 days to avoid suspension of services. Visit your nearest branch or update online.',
      receivedAt: iso(daysFromNow(0, 8, 12)),
      summary: 'Time-sensitive — needs your attention. Complete KYC — by 3 days from now.',
      urgency: 'critical',
      deadline: iso(daysFromNow(3, 18, 0)),
      actionRequired: true,
      handled: false,
      dismissed: true, // user swiped it away → Pulse will resurface it
    },
    {
      ...base(userId),
      from: 'careers@stripe.com',
      subject: 'Interview confirmation — Senior Engineer',
      body: 'Hi Alex, your interview is confirmed. Please reply to confirm your availability and complete the pre-interview form before the call.',
      receivedAt: iso(daysFromNow(0, 10, 30)),
      summary: 'Action requested from you. Confirm interview availability — soon.',
      urgency: 'action',
      deadline: iso(daysFromNow(2, 12, 0)),
      actionRequired: true,
      handled: false,
      dismissed: false,
    },
    {
      ...base(userId),
      from: 'deals@myntra.com',
      subject: 'End of season sale — up to 70% off',
      body: 'Biggest sale of the season is live. Extra discount on your wishlist items. Shop now before stock runs out.',
      receivedAt: iso(daysFromNow(-1, 19, 0)),
      summary: 'Promotional — low priority. End of season sale — no explicit deadline.',
      urgency: 'promotional',
      actionRequired: false,
      handled: false,
      dismissed: false,
    },
    {
      ...base(userId),
      from: 'admin@vtu.ac.in',
      subject: 'Transcript request processed',
      body: 'Your transcript request has been processed and is ready for collection. No further action needed.',
      receivedAt: iso(daysFromNow(-2, 14, 0)),
      summary: 'For your information. Transcript ready — no deadline.',
      urgency: 'informational',
      actionRequired: false,
      handled: true,
      dismissed: false,
    },
  ];

  // Tonight's late meeting + tomorrow's early flight = the signature nudge.
  const calendar_events: CalendarEventDoc[] = [
    {
      ...base(userId),
      title: 'Project review with leadership',
      startsAt: iso(daysFromNow(0, 19, 0)),
      endsAt: iso(daysFromNow(0, 22, 0)),
      type: 'meeting',
      location: 'Office, Bengaluru',
    },
    {
      ...base(userId),
      title: 'Flight to Delhi (6E-204)',
      startsAt: iso(daysFromNow(1, 6, 0)),
      endsAt: iso(daysFromNow(1, 8, 30)),
      type: 'flight',
      location: 'Kempegowda International Airport',
    },
    {
      ...base(userId),
      title: 'Doctor appointment — Dr. Rao',
      startsAt: iso(daysFromNow(2, 11, 0)),
      type: 'doctor',
      location: 'Manipal Hospital',
    },
  ];

  const health_records: HealthRecordDoc[] = [
    health(userId, 'vital', 'Weight', '72', 'kg', 1),
    health(userId, 'vital', 'Weight', '72.6', 'kg', 14),
    health(userId, 'vital', 'Blood Pressure', '120/80', 'mmHg', 1),
    health(userId, 'vital', 'Blood Sugar (fasting)', '95', 'mg/dL', 2),
    health(userId, 'medication', 'Vitamin D', '60,000 IU weekly', undefined, 3, 'Advised after low Vitamin D (18) on last blood report'),
    health(userId, 'symptom', 'Mild headache', undefined, undefined, 4, 'Evening, after screen time'),
  ];

  const relationship_memory: PersonDoc[] = [
    {
      ...base(userId),
      name: 'Asha',
      relation: 'wife',
      notes: ['Loves mystery novels', 'Allergic to cashews'],
      importantDates: [{ label: 'Birthday', date: iso(daysFromNow(5, 0, 0)) }],
      followUps: [],
    },
    {
      ...base(userId),
      name: 'Haresh',
      relation: 'friend',
      notes: ['Mentioned he is thinking about switching jobs'],
      importantDates: [],
      followUps: [
        {
          id: randomUUID(),
          text: 'Send him the project document',
          dueAt: iso(daysFromNow(2, 18, 0)),
          done: false,
          createdAt: iso(new Date()),
        },
      ],
    },
  ];

  return {
    users: [user],
    documents,
    email_intelligence,
    calendar_events,
    health_records,
    relationship_memory,
  };
}
