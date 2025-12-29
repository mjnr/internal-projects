import mongoose, { Schema, Document } from 'mongoose';

export type ApplicationStatus =
  | 'pending'
  | 'scraping'
  | 'evaluating'
  | 'qualified'
  | 'rejected'
  | 'error';

export interface LinkedInEducation {
  school: string;
  degree?: string;
  field?: string;
  startYear?: number;
  endYear?: number;
}

export interface LinkedInExperience {
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface LinkedInProfile {
  headline?: string;
  location?: string;
  summary?: string;
  education: LinkedInEducation[];
  experience: LinkedInExperience[];
  skills: string[];
  rawMarkdown: string;
}

export interface Evaluation {
  score: number;
  qualified: boolean;
  bullets: string[];
  reasoning: string;
  evaluatedAt: Date;
}

export interface Notifications {
  emailSentAt?: Date;
  roamNotifiedAt?: Date;
}

export interface IApplication extends Document {
  // Candidate data
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  role: string;

  // Processing status
  status: ApplicationStatus;
  errorMessage?: string;

  // LinkedIn data (after scraping)
  linkedinProfile?: LinkedInProfile;

  // AI evaluation
  evaluation?: Evaluation;

  // Notifications
  notifications: Notifications;

  // Metadata
  apifyRunId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const linkedInEducationSchema = new Schema<LinkedInEducation>(
  {
    school: { type: String, required: true },
    degree: String,
    field: String,
    startYear: Number,
    endYear: Number,
  },
  { _id: false }
);

const linkedInExperienceSchema = new Schema<LinkedInExperience>(
  {
    company: { type: String, required: true },
    title: { type: String, required: true },
    location: String,
    startDate: String,
    endDate: String,
    description: String,
  },
  { _id: false }
);

const linkedInProfileSchema = new Schema<LinkedInProfile>(
  {
    headline: String,
    location: String,
    summary: String,
    education: [linkedInEducationSchema],
    experience: [linkedInExperienceSchema],
    skills: [String],
    rawMarkdown: { type: String, required: true },
  },
  { _id: false }
);

const evaluationSchema = new Schema<Evaluation>(
  {
    score: { type: Number, required: true },
    qualified: { type: Boolean, required: true },
    bullets: [{ type: String, required: true }],
    reasoning: { type: String, required: true },
    evaluatedAt: { type: Date, required: true },
  },
  { _id: false }
);

const notificationsSchema = new Schema<Notifications>(
  {
    emailSentAt: Date,
    roamNotifiedAt: Date,
  },
  { _id: false }
);

const applicationSchema = new Schema<IApplication>(
  {
    // Candidate data
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    linkedinUrl: { type: String, required: true },
    role: { type: String, required: true },

    // Processing status
    status: {
      type: String,
      enum: ['pending', 'scraping', 'evaluating', 'qualified', 'rejected', 'error'],
      default: 'pending',
    },
    errorMessage: String,

    // LinkedIn data
    linkedinProfile: linkedInProfileSchema,

    // AI evaluation
    evaluation: evaluationSchema,

    // Notifications
    notifications: {
      type: notificationsSchema,
      default: {},
    },

    // Metadata
    apifyRunId: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
applicationSchema.index({ email: 1, role: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ createdAt: -1 });
applicationSchema.index({ apifyRunId: 1 });

export const Application = mongoose.model<IApplication>(
  'Application',
  applicationSchema
);
