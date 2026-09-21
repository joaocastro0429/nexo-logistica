import type { LoginResult } from '../../server/auth';
import type { Sessao } from '../../types';

export class AuthPresenter {
  static login(result: LoginResult, session: Sessao | null) {
    if ('challenge' in result) return { mfaRequired: true };
    return { sessao: session };
  }
}