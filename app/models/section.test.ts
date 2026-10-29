import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import type { Board, Category } from '../data/fake-board.ts'
import { resolveActiveSection } from './section.ts'

let categories: Category[] = [
  { id: 'good', boardId: 'demo', label: 'Good', position: 0 },
  { id: 'bad', boardId: 'demo', label: 'Bad', position: 1 },
  { id: 'ideas', boardId: 'demo', label: 'Ideas', position: 2 },
]

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 'demo',
    title: 'Demo',
    status: 'collecting',
    currentSectionId: null,
    ...overrides,
  }
}

describe('resolveActiveSection', () => {
  it('uses the requested section when it is a real category', () => {
    assert.equal(resolveActiveSection('bad', categories, makeBoard()), 'bad')
  })

  it('falls back to the first category when nothing is requested', () => {
    assert.equal(resolveActiveSection(null, categories, makeBoard()), 'good')
  })

  it('falls back to the first category when the requested section is unknown', () => {
    assert.equal(resolveActiveSection('zzz', categories, makeBoard()), 'good')
  })

  it("follows the organiser's section during a meeting", () => {
    let board = makeBoard({ status: 'meeting', currentSectionId: 'bad' })

    assert.equal(resolveActiveSection(null, categories, board), 'bad')
  })

  it('lets the requested section win over the organiser during a meeting', () => {
    let board = makeBoard({ status: 'meeting', currentSectionId: 'bad' })

    assert.equal(resolveActiveSection('ideas', categories, board), 'ideas')
  })

  it('ignores an organiser section that is not a real category', () => {
    let board = makeBoard({ status: 'meeting', currentSectionId: 'zzz' })

    assert.equal(resolveActiveSection(null, categories, board), 'good')
  })

  it('ignores the organiser section unless the board is in a meeting', () => {
    let board = makeBoard({ status: 'collecting', currentSectionId: 'bad' })

    assert.equal(resolveActiveSection(null, categories, board), 'good')
  })

  it('returns undefined when the board has no categories', () => {
    assert.equal(resolveActiveSection(null, [], makeBoard()), undefined)
  })
})
