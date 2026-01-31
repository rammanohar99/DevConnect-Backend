import { IPost } from './post.model'

export interface CreatePostDTO {
  title: string
  content: string
  tags?: string[]
  status?: 'draft' | 'published' | 'archived'
}

export interface UpdatePostDTO {
  title?: string
  content?: string
  tags?: string[]
  status?: 'draft' | 'published' | 'archived'
}

export interface PostFilters {
  author?: string
  tags?: string[]
  status?: 'draft' | 'published' | 'archived'
  search?: string
}

export interface Pagination {
  page: number
  limit: number
}

export interface PaginatedPosts {
  posts: IPost[]
  total: number
  page: number
  totalPages: number
  hasMore: boolean
}

export interface CreateCommentDTO {
  content: string
  parentComment?: string
}

export interface PostResponse extends Omit<IPost, 'likes' | 'bookmarks'> {
  likeCount: number
  bookmarkCount: number
  isLiked?: boolean
  isBookmarked?: boolean
}

export interface CommentResponse {
  _id: string
  post?: string
  issue?: string
  content: string
  likes: string[]
  parentComment?: string
  createdAt: Date
  updatedAt: Date
  likeCount: number
  author: {
    _id: string
    username: string
    profile: {
      name: string
      avatar?: string
    }
  }
}
