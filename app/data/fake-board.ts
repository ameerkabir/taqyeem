// Fake board data shaped like the #7 tables. Replace with D1 queries later.
// Field names mirror the future columns so the swap is mechanical.

export type BoardStatus = 'collecting' | 'meeting' | 'closed'

export interface Board {
  id: string
  title: string
  status: BoardStatus
  currentSectionId: string | null
}

export interface Category {
  id: string
  boardId: string
  label: string
  position: number
}

export interface Member {
  id: string
  boardId: string
  displayName: string
}

export interface Card {
  id: string
  boardId: string
  categoryId: string
  memberId: string
  body: string
  isAnonymous: boolean
  voteCount: number
  createdAt: string
}

export const board: Board = {
  id: 'demo',
  title: 'مراجعة السبرنت ١٤',
  status: 'collecting',
  currentSectionId: null,
}

// Ids double as the `?section=` value, so keep them short and URL-safe.
export const categories: Category[] = [
  { id: 'good', boardId: 'demo', label: 'ما سار بشكل جيد', position: 0 },
  { id: 'bad', boardId: 'demo', label: 'ما لم يسر جيدًا', position: 1 },
  // No cards on purpose: use it to build the empty state.
  { id: 'ideas', boardId: 'demo', label: 'أفكار', position: 2 },
]

export const members: Member[] = [
  { id: 'm1', boardId: 'demo', displayName: 'أحمد' },
  { id: 'm2', boardId: 'demo', displayName: 'سارة' },
  { id: 'm3', boardId: 'demo', displayName: 'عمر' },
]

// The signed-in device. Cards with this memberId get the "…" menu.
export const viewerMemberId = 'm1'

// Cards the viewer has already voted for (pressed state on the vote pill).
export const viewerVotedCardIds = new Set(['c2', 'c5'])

export const cards: Card[] = [
  {
    id: 'c1',
    boardId: 'demo',
    categoryId: 'good',
    memberId: 'm1',
    body: 'إطلاق النسخة التجريبية في الموعد المحدد.',
    isAnonymous: false,
    voteCount: 3,
    createdAt: '2026-10-20T09:15:00Z',
  },
  {
    id: 'c2',
    boardId: 'demo',
    categoryId: 'good',
    memberId: 'm2',
    body: 'التعاون بين الفريقين كان ممتازًا.',
    isAnonymous: false,
    voteCount: 5,
    createdAt: '2026-10-20T10:40:00Z',
  },
  {
    id: 'c3',
    boardId: 'demo',
    categoryId: 'good',
    memberId: 'm3',
    body: 'مراجعات الكود كانت سريعة ومفيدة.',
    isAnonymous: true,
    voteCount: 1,
    createdAt: '2026-10-21T08:05:00Z',
  },
  {
    id: 'c4',
    boardId: 'demo',
    categoryId: 'bad',
    memberId: 'm2',
    body: 'الاجتماعات طويلة وبلا جدول أعمال واضح.',
    isAnonymous: true,
    voteCount: 4,
    createdAt: '2026-10-20T13:20:00Z',
  },
  {
    id: 'c5',
    boardId: 'demo',
    categoryId: 'bad',
    memberId: 'm1',
    body: 'تأخرنا في اختبار الأجهزة المحمولة حتى آخر يوم.',
    isAnonymous: false,
    voteCount: 6,
    createdAt: '2026-10-21T11:00:00Z',
  },
  {
    id: 'c6',
    boardId: 'demo',
    categoryId: 'bad',
    memberId: 'm3',
    body: 'فشل الـ deploy مرتين بسبب متغير env مفقود في production.',
    isAnonymous: false,
    voteCount: 0,
    createdAt: '2026-10-22T07:30:00Z',
  },
]
