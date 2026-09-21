import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

// Erros de driver podem conter SQL e valores sensíveis; não registrar o objeto bruto.
@Catch()
export class SecurityExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus()
      : (exception as { status?: number })?.status === 400 ? 400 : 500;
    if (status >= 500) console.error(`Requisição interrompida com status ${status}.`);
    const body = exception instanceof HttpException && status < 500 ? exception.getResponse()
      : { statusCode: status, message: status === 400 ? 'Dados inválidos.' : 'Serviço indisponível. Tente novamente.' };
    response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}
