import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../lib/auth';
import { Mail, Lock, User } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
});

const registerSchema = loginSchema.extend({
  fullName: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
});

type LoginInputs = z.infer<typeof loginSchema>;
type RegisterInputs = z.infer<typeof registerSchema>;

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const { signIn, signUp } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RegisterInputs>({
    resolver: zodResolver(isLogin ? loginSchema : registerSchema),
  });

  const onSubmit = async (data: RegisterInputs) => {
    try {
      setError(null);
      if (isLogin) {
        await signIn(data.email, data.password);
      } else {
        await signUp(data.email, data.password, data.fullName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro');
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    reset();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {isLogin ? 'Entre na sua conta' : 'Crie sua conta'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {!isLogin && (
              <div className="form-group">
                <label htmlFor="register-fullname" className="form-label">
                  Nome completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="register-fullname"
                    {...register('fullName')}
                    type="text"
                    className="form-input pl-12"
                  />
                </div>
                {errors.fullName && (
                  <p className="form-error">{errors.fullName.message}</p>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="auth-email" className="form-label">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="auth-email"
                  {...register('email')}
                  type="email"
                  className="form-input pl-12"
                />
              </div>
              {errors.email && (
                <p className="form-error">{errors.email.message}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="auth-password" className="form-label">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="auth-password"
                  {...register('password')}
                  type="password"
                  className="form-input pl-12"
                />
              </div>
              {errors.password && (
                <p className="form-error">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <button
              type="button"
              onClick={toggleMode}
              className="w-full text-center text-sm text-primary-600 hover:text-primary-500"
            >
              {isLogin
                ? 'Não tem uma conta? Cadastre-se'
                : 'Já tem uma conta? Entre'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}