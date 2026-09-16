export type Role = 'Admin' | 'Staff' | 'Supervisor' | 'Hr'
export type ReportStatus = 'Draft' | 'Submitted' | 'Approved' | 'Declined'
export type ActivityProgress = 'Ongoing' | 'Completed'
export type FocusStatus = 'Pending' | 'Completed' | 'Update'
export type ItemReviewStatus = 'Pending' | 'Approved' | 'Declined'

export interface Me {
  id: string
  email: string
  fullName: string
  role: Role
  staffId: string | null
  department: string | null
  jobTitle: string | null
  supervisorName: string | null
  supervisorEmail: string | null
  supervisorUserId: string | null
  isActive: boolean
}

export interface UserItem {
  id: string
  email: string
  fullName: string
  role: Role
  staffId: string | null
  department: string | null
  jobTitle: string | null
  supervisorName: string | null
  supervisorEmail: string | null
  supervisorUserId: string | null
  supervisorUserName: string | null
  isActive: boolean
  hasEntraLink: boolean
  createdAt: string
}

export interface ActivityRow {
  id: string
  lineNo: number
  keyActivity: string | null
  descriptionOfWork: string | null
  outputResult: string | null
  status: ActivityProgress | null
  rolledOver: boolean
  reviewStatus: ItemReviewStatus
  reviewComment: string | null
}

export interface FocusRow {
  id: string
  lineNo: number
  plannedActivity: string | null
  expectedOutcome: string | null
  supportRequired: string | null
  status: FocusStatus
  rolledOver: boolean
  reviewStatus: ItemReviewStatus
  reviewComment: string | null
}

export interface ReportSummary {
  id: string
  staffUserId: string
  staffName: string
  staffEmail: string
  staffId: string | null
  department: string | null
  year: number
  month: number
  status: ReportStatus
  overallRating: number | null
  submittedAt: string | null
  reviewedAt: string | null
  updatedAt: string
}

export interface Report {
  id: string
  staffUserId: string
  staffName: string
  staffEmail: string
  staffId: string | null
  department: string | null
  jobTitle: string | null
  supervisorName: string | null
  year: number
  month: number
  status: ReportStatus
  keyAchievements: string | null
  innovations: string | null
  newSkills: string | null
  knowledgeGained: string | null
  toolsLearned: string | null
  keyChallenges: string | null
  supportRequired: string | null
  staffSignatureName: string | null
  staffSignOffDate: string | null
  submittedAt: string | null
  qualityOfWorkRating: number | null
  qualityOfWorkComment: string | null
  productivityRating: number | null
  productivityComment: string | null
  initiativeRating: number | null
  initiativeComment: string | null
  teamworkRating: number | null
  teamworkComment: string | null
  complianceRating: number | null
  complianceComment: string | null
  overallRating: number | null
  supervisorGeneralComments: string | null
  supervisorSignatureName: string | null
  supervisorSignOffDate: string | null
  decisionComment: string | null
  reviewedByUserId: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  activities: ActivityRow[]
  focusAreas: FocusRow[]
  createdAt: string
  updatedAt: string
}

export interface ActivityLogItem {
  id: string
  actorUserId: string | null
  actorEmail: string
  action: string
  entityType: string
  entityId: string | null
  summary: string
  createdAt: string
}

export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface ArchivedStaffSummary {
  id: string
  originalUserId: string
  email: string
  fullName: string
  staffId: string | null
  department: string | null
  jobTitle: string | null
  role: Role
  reportCount: number
  archivedAt: string
  archivedByEmail: string
}

export interface ArchivedStaffDetail extends ArchivedStaffSummary {
  snapshot: {
    user: UserItem
    reports: Report[]
  }
}

export interface StaffPerformance {
  userId: string
  fullName: string
  department: string | null
  reviewedReports: number
  declinedReports: number
  avgOverallRating: number | null
  latestOverallRating: number | null
}

export interface HrAnalytics {
  activeStaff: number
  newStaffLast30Days: number
  staffWithoutSupervisor: number
  supervisors: number
  departments: number
  archivedStaff: number
  totalReports: number
  draftReports: number
  awaitingReview: number
  approvedReports: number
  declinedReports: number
  reportsThisMonth: number
  submittedThisMonth: number
  avgOverallRating: number | null
  approvalRate: number | null
  parameters: {
    qualityOfWork: number | null
    productivity: number | null
    initiative: number | null
    teamwork: number | null
    compliance: number | null
  }
  byDepartment: {
    department: string
    staffCount: number
    reportCount: number
    avgOverallRating: number | null
  }[]
  trend: {
    year: number
    month: number
    reportCount: number
    approvedCount: number
    avgOverallRating: number | null
  }[]
  topPerformers: StaffPerformance[]
  needsAttention: StaffPerformance[]
}
