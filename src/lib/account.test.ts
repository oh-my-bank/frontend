import { describe, expect, it } from 'vitest'
import { passwordChangeErrors, serverPasswordErrors } from './account'

const valid = {
  currentPassword: 'OmbDemo123!',
  newPassword: 'OmbChanged456!',
  confirmPassword: 'OmbChanged456!',
}

describe('password change checks', () => {
  it('accepts a different password of at least ten characters', () => {
    expect(passwordChangeErrors(valid)).toEqual({})
  })
  it('requires the current password and a matching confirmation', () => {
    const errors = passwordChangeErrors({ ...valid, currentPassword: '', confirmPassword: 'x' })
    expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'currentPassword'])
  })
  it('applies the server length rules, counting UTF-8 bytes rather than characters', () => {
    expect(
      passwordChangeErrors({ ...valid, newPassword: 'short', confirmPassword: 'short' })
        .newPassword,
    ).toContain('10자')
    const korean = '가'.repeat(25) // 25 characters but 75 bytes
    expect(
      passwordChangeErrors({ ...valid, newPassword: korean, confirmPassword: korean }).newPassword,
    ).toContain('72바이트')
    const ascii = 'a'.repeat(72)
    expect(passwordChangeErrors({ ...valid, newPassword: ascii, confirmPassword: ascii })).toEqual(
      {},
    )
  })
  it('rejects reusing the current password', () => {
    const same = {
      ...valid,
      newPassword: valid.currentPassword,
      confirmPassword: valid.currentPassword,
    }
    expect(passwordChangeErrors(same).newPassword).toContain('달라야')
  })
  it('maps only this form’s server field errors', () => {
    expect(serverPasswordErrors({ currentPassword: '불일치', other: 'x' })).toEqual({
      currentPassword: '불일치',
    })
  })
})
