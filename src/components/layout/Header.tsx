import React from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { 
  Scissors, 
  Menu, 
  X, 
  Database, 
  Users, 
  Calendar, 
  DollarSign, 
  BarChart, 
  Settings,
  Tag,
  Crown,
  CalendarClock
} from 'lucide-react';
import { useAuth } from '../../lib/auth';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const location = useLocation();
  const { signOut, profile } = useAuth();

  // Define navigation items based on user role
  const getNavigationItems = () => {
    if (!profile) return [];

    if (profile.role === 'admin') {
      return [
        {
          group: 'Cadastros',
          icon: <Database className="h-5 w-5" />,
          items: [
            { name: 'Categorias', href: '/categories' },
            { name: 'Serviços', href: '/services' },
            { name: 'Produtos', href: '/products' },
            { name: 'Clientes', href: '/clients' },
          ]
        },
        {
          group: 'Operacional',
          icon: <Calendar className="h-5 w-5" />,
          items: [
            { name: 'Dashboard', href: '/' },
            { name: 'Agenda', href: '/appointments' },
            { name: 'Comandas', href: '/orders' },
            { name: 'Caixa', href: '/cash-register' },
          ]
        },
        {
          group: 'Gestão',
          icon: <BarChart className="h-5 w-5" />,
          items: [
            { name: 'Relatórios', href: '/reports' },
            { name: 'Importar', href: '/import' },
            { name: 'Fidelidade', href: '/loyalty' },
          ]
        },
        {
          group: 'Configurações',
          icon: <Settings className="h-5 w-5" />,
          items: [
            { name: 'Usuários', href: '/users' },
            { name: 'Configurações', href: '/settings' },
          ]
        }
      ];
    }

    if (profile.role === 'barber') {
      return [
        {
          group: 'Operacional',
          icon: <Calendar className="h-5 w-5" />,
          items: [
            { name: 'Dashboard', href: '/' },
            { name: 'Agenda', href: '/appointments' },
            { name: 'Comandas', href: '/orders' },
            { name: 'Meus Horários', href: '/time-settings', icon: <CalendarClock className="h-4 w-4 mr-1" /> },
          ]
        },
        {
          group: 'Cadastros',
          icon: <Database className="h-5 w-5" />,
          items: [
            { name: 'Clientes', href: '/clients' },
          ]
        }
      ];
    }

    // Client role
    return [
      {
        group: 'Minha Conta',
        icon: <Users className="h-5 w-5" />,
        items: [
          { name: 'Dashboard', href: '/' },
          { name: 'Agendar', href: '/appointments' },
          { name: 'Minhas Comandas', href: '/orders' },
        ]
      }
    ];
  };

  const navigation = getNavigationItems();
  const isActive = (path: string) => location.pathname === path;

  // Redirect clients to appointments if they try to access restricted pages
  if (profile?.role === 'client' && 
      !['/appointments', '/orders', '/login'].includes(location.pathname)) {
    return <Navigate to="/appointments" />;
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-16 justify-between">
          <div className="flex items-center">
            <Link to="/" className="flex flex-shrink-0 items-center">
              <Scissors className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">BarberPro</span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            {navigation.map((group) => (
              <div key={group.group} className="relative group">
                <button className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                  {group.icon}
                  <span>{group.group}</span>
                </button>
                <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        title={`Ir para ${item.name.toLowerCase()}`}
                        className={`block px-4 py-2 text-sm ${
                          isActive(item.href)
                            ? 'bg-primary-50 text-primary-900'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        {item.icon && item.icon}
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* User menu (desktop) */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <span className="text-sm text-gray-700">
              {profile?.full_name}
              <span className="ml-2 text-xs text-gray-500">
                ({profile?.role === 'admin' ? 'Administrador' : 
                  profile?.role === 'barber' ? 'Barbeiro' : 'Cliente'})
              </span>
            </span>
            <button
              onClick={() => signOut()}
              title="Sair do sistema"
              className="ml-4 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Sair
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title={isMenuOpen ? "Fechar menu" : "Abrir menu"}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
            >
              {isMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'}`}>
          {navigation.map((group) => (
            <div key={group.group} className="px-2 pt-2 pb-3 space-y-1">
              <div className="px-3 py-2 text-sm font-medium text-gray-900 flex items-center space-x-2">
                {group.icon}
                <span>{group.group}</span>
              </div>
              {group.items.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  title={`Ir para ${item.name.toLowerCase()}`}
                  className={`block px-3 py-2 text-base font-medium rounded-md ${
                    isActive(item.href)
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.icon && item.icon}{item.name}
                </Link>
              ))}
            </div>
          ))}
          <div className="border-t border-gray-200 pb-3 pt-4">
            <div className="px-4 py-2">
              <p className="text-base font-medium text-gray-800">{profile?.full_name}</p>
              <p className="text-sm text-gray-500">
                {profile?.role === 'admin' ? 'Administrador' : 
                  profile?.role === 'barber' ? 'Barbeiro' : 'Cliente'}
              </p>
            </div>
            <button
              onClick={() => {
                signOut();
                setIsMenuOpen(false);
              }}
              title="Sair do sistema"
              className="block w-full px-4 py-2 text-left text-base font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}