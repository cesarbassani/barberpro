import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../lib/supabase';
import { 
  Building, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  Image, 
  Save,
  RefreshCw,
  HelpCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

// Schema for company information
const companyInfoSchema = z.object({
  companyName: z.string().min(3, 'Nome da empresa deve ter ao menos 3 caracteres'),
  tradingName: z.string().min(2, 'Nome fantasia deve ter ao menos 2 caracteres'),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$/, 'CNPJ inválido'),
  stateRegistration: z.string().optional(),
  municipalRegistration: z.string().optional(),
  
  address: z.object({
    street: z.string().min(3, 'Rua/Avenida é obrigatório'),
    number: z.string().min(1, 'Número é obrigatório'),
    complement: z.string().optional(),
    neighborhood: z.string().min(2, 'Bairro é obrigatório'),
    city: z.string().min(2, 'Cidade é obrigatória'),
    state: z.string().length(2, 'UF deve ter 2 caracteres'),
    postalCode: z.string().regex(/^\d{5}\-\d{3}$/, 'CEP inválido')
  }),
  
  contact: z.object({
    phone: z.string().min(10, 'Telefone inválido'),
    mobilePhone: z.string().min(11, 'Celular inválido'),
    email: z.string().email('Email inválido'),
    website: z.string().url('Website inválido').optional()
  }),
  
  branding: z.object({
    logoUrl: z.string().url('URL inválida').optional(),
    primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Cor inválida'),
    secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Cor inválida').optional()
  })
});

type CompanyInfoData = z.infer<typeof companyInfoSchema>;

export function CompanyInfoSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue,
    reset,
    formState: { errors } 
  } = useForm<CompanyInfoData>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues: {
      branding: {
        primaryColor: '#0284c7',
        secondaryColor: '#075985'
      }
    }
  });

  // Load company data on component mount
  useEffect(() => {
    const loadCompanyInfo = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'company_info')
          .single();
        
        if (error) {
          if (error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            throw error;
          }
          // If no data, keep defaults
          return;
        }
        
        if (data?.value) {
          reset(data.value as CompanyInfoData);
        }
      } catch (error) {
        console.error('Error loading company info:', error);
        toast.error('Erro ao carregar informações da empresa');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCompanyInfo();
  }, [reset]);

  const onSubmit = async (data: CompanyInfoData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'company_info',
          value: data
        }, {
          onConflict: 'key'
        });
      
      if (error) throw error;
      
      toast.success('Informações da empresa salvas com sucesso!');
    } catch (error) {
      console.error('Error saving company info:', error);
      toast.error('Erro ao salvar informações da empresa');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaskChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const { value } = e.target;
    
    let maskedValue = value;
    
    if (field === 'cnpj') {
      // Format as XX.XXX.XXX/XXXX-XX
      maskedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
    } else if (field === 'postalCode') {
      // Format as XXXXX-XXX
      maskedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{3})\d+?$/, '$1');
    } else if (field === 'phone') {
      // Format as (XX) XXXX-XXXX
      maskedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
    } else if (field === 'mobilePhone') {
      // Format as (XX) XXXXX-XXXX
      maskedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
    }
    
    setValue(field as any, maskedValue);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-lg rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <Building className="h-6 w-6 text-primary-600 mr-2" />
            <h3 className="text-lg font-medium leading-6 text-gray-900">Informações da Empresa</h3>
          </div>
          <div className="tooltip">
            <HelpCircle className="h-5 w-5 text-gray-400" />
            <span className="tooltiptext">
              Informações da empresa utilizadas em documentos, relatórios e interfaces do sistema.
            </span>
          </div>
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <Info className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Estes dados aparecerão em relatórios, recibos e na interface do sistema. Certifique-se de que estão corretos para conformidade legal.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Section: Informações Básicas */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Informações Básicas
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="tooltip">
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                  Razão Social
                </label>
                <span className="tooltiptext">Nome formal da empresa registrado na Receita Federal</span>
                <input
                  type="text"
                  id="companyName"
                  {...register('companyName')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Razão Social completa"
                />
                {errors.companyName && (
                  <p className="mt-1 text-sm text-red-600">{errors.companyName.message}</p>
                )}
              </div>
              
              <div className="tooltip">
                <label htmlFor="tradingName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Fantasia
                </label>
                <span className="tooltiptext">Nome usado comercialmente pela empresa</span>
                <input
                  type="text"
                  id="tradingName"
                  {...register('tradingName')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Nome Fantasia"
                />
                {errors.tradingName && (
                  <p className="mt-1 text-sm text-red-600">{errors.tradingName.message}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="tooltip">
                <label htmlFor="cnpj" className="block text-sm font-medium text-gray-700 mb-1">
                  CNPJ
                </label>
                <span className="tooltiptext">Cadastro Nacional da Pessoa Jurídica</span>
                <input
                  type="text"
                  id="cnpj"
                  value={watch('cnpj') || ''}
                  onChange={(e) => handleMaskChange(e, 'cnpj')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="XX.XXX.XXX/XXXX-XX"
                />
                {errors.cnpj && (
                  <p className="mt-1 text-sm text-red-600">{errors.cnpj.message}</p>
                )}
              </div>
              
              <div className="tooltip">
                <label htmlFor="stateRegistration" className="block text-sm font-medium text-gray-700 mb-1">
                  Inscrição Estadual
                </label>
                <span className="tooltiptext">Número de inscrição no cadastro estadual, se aplicável</span>
                <input
                  type="text"
                  id="stateRegistration"
                  {...register('stateRegistration')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Inscrição Estadual (opcional)"
                />
              </div>
              
              <div className="tooltip">
                <label htmlFor="municipalRegistration" className="block text-sm font-medium text-gray-700 mb-1">
                  Inscrição Municipal
                </label>
                <span className="tooltiptext">Número de inscrição no cadastro municipal, se aplicável</span>
                <input
                  type="text"
                  id="municipalRegistration"
                  {...register('municipalRegistration')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Inscrição Municipal (opcional)"
                />
              </div>
            </div>
          </div>

          {/* Section: Endereço */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-primary-600" />
              Endereço
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
              <div className="md:col-span-8">
                <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
                  Rua/Avenida
                </label>
                <input
                  type="text"
                  id="street"
                  {...register('address.street')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Rua, Avenida, etc."
                />
                {errors.address?.street && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.street.message}</p>
                )}
              </div>
              
              <div className="md:col-span-4">
                <label htmlFor="number" className="block text-sm font-medium text-gray-700 mb-1">
                  Número
                </label>
                <input
                  type="text"
                  id="number"
                  {...register('address.number')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Número"
                />
                {errors.address?.number && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.number.message}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
              <div className="md:col-span-6">
                <label htmlFor="complement" className="block text-sm font-medium text-gray-700 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  id="complement"
                  {...register('address.complement')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Complemento (opcional)"
                />
              </div>
              
              <div className="md:col-span-6">
                <label htmlFor="neighborhood" className="block text-sm font-medium text-gray-700 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  id="neighborhood"
                  {...register('address.neighborhood')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Bairro"
                />
                {errors.address?.neighborhood && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.neighborhood.message}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5">
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  id="city"
                  {...register('address.city')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Cidade"
                />
                {errors.address?.city && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.city.message}</p>
                )}
              </div>
              
              <div className="md:col-span-2">
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                  UF
                </label>
                <input
                  type="text"
                  id="state"
                  {...register('address.state')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="UF"
                  maxLength={2}
                />
                {errors.address?.state && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.state.message}</p>
                )}
              </div>
              
              <div className="md:col-span-5">
                <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  id="postalCode"
                  value={watch('address.postalCode') || ''}
                  onChange={(e) => handleMaskChange(e, 'postalCode')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="XXXXX-XXX"
                />
                {errors.address?.postalCode && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.postalCode.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section: Contato */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <Phone className="h-4 w-4 mr-2 text-primary-600" />
              Contato
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  id="phone"
                  value={watch('contact.phone') || ''}
                  onChange={(e) => handleMaskChange(e, 'phone')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="(XX) XXXX-XXXX"
                />
                {errors.contact?.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.contact.phone.message}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="mobilePhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Celular
                </label>
                <input
                  type="text"
                  id="mobilePhone"
                  value={watch('contact.mobilePhone') || ''}
                  onChange={(e) => handleMaskChange(e, 'mobilePhone')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="(XX) XXXXX-XXXX"
                />
                {errors.contact?.mobilePhone && (
                  <p className="mt-1 text-sm text-red-600">{errors.contact.mobilePhone.message}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  {...register('contact.email')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="email@exemplo.com"
                />
                {errors.contact?.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.contact.email.message}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="text"
                  id="website"
                  {...register('contact.website')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="https://www.exemplo.com (opcional)"
                />
                {errors.contact?.website && (
                  <p className="mt-1 text-sm text-red-600">{errors.contact.website.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section: Identidade Visual */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <Image className="h-4 w-4 mr-2 text-primary-600" />
              Identidade Visual
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-1">
                <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  URL do Logo
                </label>
                <input
                  type="text"
                  id="logoUrl"
                  {...register('branding.logoUrl')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="https://exemplo.com/logo.png"
                />
                {errors.branding?.logoUrl && (
                  <p className="mt-1 text-sm text-red-600">{errors.branding.logoUrl.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">URL para o logo da empresa. Use um serviço como o Imgur para hospedar.</p>
              </div>
              
              <div className="md:col-span-1">
                <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 mb-1">
                  Cor Primária
                </label>
                <div className="flex">
                  <input
                    type="color"
                    id="primaryColorPicker"
                    value={watch('branding.primaryColor') || '#0284c7'}
                    onChange={(e) => setValue('branding.primaryColor', e.target.value)}
                    className="h-10 w-10 rounded-l-md border-gray-300"
                  />
                  <input
                    type="text"
                    id="primaryColor"
                    {...register('branding.primaryColor')}
                    className="block w-full rounded-r-md border-gray-300 shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="#000000"
                  />
                </div>
                {errors.branding?.primaryColor && (
                  <p className="mt-1 text-sm text-red-600">{errors.branding.primaryColor.message}</p>
                )}
              </div>
              
              <div className="md:col-span-1">
                <label htmlFor="secondaryColor" className="block text-sm font-medium text-gray-700 mb-1">
                  Cor Secundária (opcional)
                </label>
                <div className="flex">
                  <input
                    type="color"
                    id="secondaryColorPicker"
                    value={watch('branding.secondaryColor') || '#075985'}
                    onChange={(e) => setValue('branding.secondaryColor', e.target.value)}
                    className="h-10 w-10 rounded-l-md border-gray-300"
                  />
                  <input
                    type="text"
                    id="secondaryColor"
                    {...register('branding.secondaryColor')}
                    className="block w-full rounded-r-md border-gray-300 shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="#000000"
                  />
                </div>
                {errors.branding?.secondaryColor && (
                  <p className="mt-1 text-sm text-red-600">{errors.branding.secondaryColor.message}</p>
                )}
              </div>
            </div>
            
            {/* Preview */}
            {watch('branding.logoUrl') && (
              <div className="mt-4 bg-gray-50 p-4 rounded-md">
                <h5 className="text-sm font-medium text-gray-900 mb-2">Preview do Logo</h5>
                <div className="flex justify-center">
                  <img 
                    src={watch('branding.logoUrl')} 
                    alt="Logo da empresa" 
                    className="max-h-32 object-contain"
                    onError={(e) => {
                      e.currentTarget.src = 'https://placehold.co/200x100?text=Logo+inválido';
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit buttons */}
          <div className="pt-5 border-t border-gray-200">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => reset()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Restaurar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="ml-3 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar informações
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}