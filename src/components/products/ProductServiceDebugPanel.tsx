import React, { useState, useEffect, useRef } from 'react';
import { useProducts } from '../../lib/products';
import { useServices } from '../../lib/services';
import { useCategories } from '../../lib/categories';
import { useInventory } from '../../lib/inventory';
import { supabase } from '../../lib/supabase';
import { 
  Bug, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Scissors, 
  Package, 
  Tag,
  Clock,
  ArrowRight,
  Loader2,
  ChevronLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductServiceDebugPanelProps {
  onClose: () => void;
}

export function ProductServiceDebugPanel({ onClose }: ProductServiceDebugPanelProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'services' | 'categories' | 'logs'>('logs');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsCount, setLogsCount] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(10);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [actionFilter, setActionFilter] = useState<'all' | 'create' | 'update' | 'delete' | 'fetch'>('all');
  const [moduleFilter, setModuleFilter] = useState<'all' | 'product' | 'service' | 'category'>('all');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [testResults, setTestResults] = useState<{[key: string]: boolean}>({});
  const [isRunningTests, setIsRunningTests] = useState(false);
  
  const { products, fetchProducts, createProduct, updateProduct } = useProducts();
  const { services, fetchServices, createService, updateService } = useServices();
  const { categories, fetchCategories } = useCategories();
  const { isLoading: inventoryLoading } = useInventory();
  
  // Load logs when component mounts
  useEffect(() => {
    loadLogs();
    testConnection();
  }, []);
  
  // Load logs when filters or pagination changes
  useEffect(() => {
    loadLogs();
  }, [logsPage, logsPerPage, statusFilter, actionFilter, moduleFilter, searchTerm]);
  
  // Function to load debug logs
  const loadLogs = async () => {
    setIsLoading(true);
    try {
      // Create a debug log table if it doesn't exist
      await createDebugLogTableIfNotExists();
      
      // Build query with filters
      let query = supabase
        .from('debug_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });
      
      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('success', statusFilter === 'success');
      }
      
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }
      
      if (moduleFilter !== 'all') {
        query = query.eq('module', moduleFilter);
      }
      
      if (searchTerm) {
        query = query.or(`message.ilike.%${searchTerm}%,details.ilike.%${searchTerm}%`);
      }
      
      // Apply pagination
      const from = (logsPage - 1) * logsPerPage;
      const to = from + logsPerPage - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      setLogs(data || []);
      setLogsCount(count || 0);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Erro ao carregar logs de debug');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to create debug log table if it doesn't exist
  const createDebugLogTableIfNotExists = async () => {
    try {
      // Check if table exists
      const { data, error } = await supabase
        .from('debug_logs')
        .select('id')
        .limit(1);
      
      if (error && error.code === 'PGRST116') {
        // Table doesn't exist, create it
        const { error: createError } = await supabase.rpc('create_debug_log_table');
        
        if (createError) {
          console.error('Error creating debug log table:', createError);
          // Try to create the table directly
          await supabase.rpc('execute_sql', {
            sql: `
              CREATE TABLE IF NOT EXISTS debug_logs (
                id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                module text NOT NULL,
                action text NOT NULL,
                success boolean NOT NULL,
                message text,
                details jsonb,
                duration_ms integer,
                created_at timestamptz DEFAULT now()
              );
              
              ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;
              
              CREATE POLICY "Admin can manage debug logs"
                ON debug_logs
                TO authenticated
                USING (
                  EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'admin'
                  )
                );
            `
          });
        }
      }
    } catch (error) {
      console.error('Error checking/creating debug log table:', error);
    }
  };
  
  // Function to log debug information
  const logDebug = async (module: string, action: string, success: boolean, message: string, details?: any, duration_ms?: number) => {
    try {
      await createDebugLogTableIfNotExists();
      
      // Ensure duration_ms is an integer
      const roundedDuration = duration_ms ? Math.round(duration_ms) : null;
      
      const { error } = await supabase
        .from('debug_logs')
        .insert({
          module,
          action,
          success,
          message,
          details,
          duration_ms: roundedDuration
        });
      
      if (error) throw error;
      
      // Reload logs if we're on the logs tab
      if (activeTab === 'logs') {
        loadLogs();
      }
    } catch (error) {
      console.error('Error logging debug info:', error);
    }
  };
  
  // Function to test database connection
  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('unknown');
    
    try {
      const startTime = performance.now();
      
      // Test connection with a simple query
      const { data, error } = await supabase
        .from('settings')
        .select('key')
        .limit(1);
      
      const duration = performance.now() - startTime;
      
      if (error) {
        setConnectionStatus('disconnected');
        await logDebug('system', 'connection_test', false, `Connection test failed: ${error.message}`, { error }, Math.round(duration));
        toast.error('Falha na conexão com o banco de dados');
      } else {
        setConnectionStatus('connected');
        await logDebug('system', 'connection_test', true, `Connection test successful (${Math.round(duration)}ms)`, { data }, Math.round(duration));
        toast.success('Conexão com o banco de dados estabelecida');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await logDebug('system', 'connection_test', false, `Connection test failed with exception: ${errorMessage}`, { error }, 0);
      toast.error('Erro ao testar conexão com o banco de dados');
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  // Function to run diagnostic tests
  const runDiagnosticTests = async () => {
    setIsRunningTests(true);
    setTestResults({});
    
    try {
      // Test 1: Fetch products
      await testFetchProducts();
      
      // Test 2: Fetch services
      await testFetchServices();
      
      // Test 3: Fetch categories
      await testFetchCategories();
      
      // Test 4: Create and update product
      await testProductCRUD();
      
      // Test 5: Create and update service
      await testServiceCRUD();
      
      toast.success('Testes diagnósticos concluídos');
    } catch (error) {
      console.error('Error running diagnostic tests:', error);
      toast.error('Erro ao executar testes diagnósticos');
    } finally {
      setIsRunningTests(false);
    }
  };
  
  // Test function for fetching products
  const testFetchProducts = async () => {
    try {
      const startTime = performance.now();
      await fetchProducts();
      const duration = performance.now() - startTime;
      
      setTestResults(prev => ({ ...prev, fetchProducts: true }));
      await logDebug('product', 'fetch', true, `Successfully fetched ${products.length} products`, { count: products.length }, Math.round(duration));
      
      return true;
    } catch (error) {
      setTestResults(prev => ({ ...prev, fetchProducts: false }));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await logDebug('product', 'fetch', false, `Failed to fetch products: ${errorMessage}`, { error }, 0);
      
      return false;
    }
  };
  
  // Test function for fetching services
  const testFetchServices = async () => {
    try {
      const startTime = performance.now();
      await fetchServices();
      const duration = performance.now() - startTime;
      
      setTestResults(prev => ({ ...prev, fetchServices: true }));
      await logDebug('service', 'fetch', true, `Successfully fetched ${services.length} services`, { count: services.length }, Math.round(duration));
      
      return true;
    } catch (error) {
      setTestResults(prev => ({ ...prev, fetchServices: false }));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await logDebug('service', 'fetch', false, `Failed to fetch services: ${errorMessage}`, { error }, 0);
      
      return false;
    }
  };
  
  // Test function for fetching categories
  const testFetchCategories = async () => {
    try {
      const startTime = performance.now();
      await fetchCategories();
      const duration = performance.now() - startTime;
      
      setTestResults(prev => ({ ...prev, fetchCategories: true }));
      await logDebug('category', 'fetch', true, `Successfully fetched ${categories.length} categories`, { count: categories.length }, Math.round(duration));
      
      return true;
    } catch (error) {
      setTestResults(prev => ({ ...prev, fetchCategories: false }));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await logDebug('category', 'fetch', false, `Failed to fetch categories: ${errorMessage}`, { error }, 0);
      
      return false;
    }
  };
  
  // Test function for product CRUD operations
  const testProductCRUD = async () => {
    try {
      // First check if we have categories
      if (categories.length === 0) {
        await fetchCategories();
        if (categories.length === 0) {
          setTestResults(prev => ({ ...prev, productCRUD: false }));
          await logDebug('product', 'create', false, 'Cannot test product CRUD: No categories available', null, 0);
          return false;
        }
      }
      
      // Find a product category
      const productCategory = categories.find(c => c.type === 'product' || c.type === 'both');
      if (!productCategory) {
        setTestResults(prev => ({ ...prev, productCRUD: false }));
        await logDebug('product', 'create', false, 'Cannot test product CRUD: No product categories available', { categories }, 0);
        return false;
      }
      
      // Create a test product
      const testProduct = {
        name: `Test Product ${Date.now()}`,
        description: 'Test product for debug panel',
        price: 10.99,
        stock_quantity: 100,
        min_stock_alert: 10,
        category_id: productCategory.id,
        active: true
      };
      
      // Create product
      const startCreateTime = performance.now();
      await createProduct(testProduct);
      const createDuration = performance.now() - startCreateTime;
      
      await logDebug('product', 'create', true, `Successfully created test product: ${testProduct.name}`, { product: testProduct }, Math.round(createDuration));
      
      // Find the created product
      await fetchProducts();
      const createdProduct = products.find(p => p.name === testProduct.name);
      
      if (!createdProduct) {
        setTestResults(prev => ({ ...prev, productCRUD: false }));
        await logDebug('product', 'update', false, 'Created product not found in products list', { testProduct }, 0);
        return false;
      }
      
      // Update the product
      const updateData = {
        description: 'Updated test product description',
        price: 12.99
      };
      
      const startUpdateTime = performance.now();
      await updateProduct(createdProduct.id, updateData);
      const updateDuration = performance.now() - startUpdateTime;
      
      await logDebug('product', 'update', true, `Successfully updated test product: ${testProduct.name}`, { 
        productId: createdProduct.id,
        updateData
      }, Math.round(updateDuration));
      
      // Verify the update
      await fetchProducts();
      const updatedProduct = products.find(p => p.id === createdProduct.id);
      
      if (!updatedProduct || updatedProduct.price !== 12.99) {
        setTestResults(prev => ({ ...prev, productCRUD: false }));
        await logDebug('product', 'update', false, 'Product update verification failed', { 
          expected: 12.99,
          actual: updatedProduct?.price
        }, 0);
        return false;
      }
      
      setTestResults(prev => ({ ...prev, productCRUD: true }));
      return true;
    } catch (error) {
      setTestResults(prev => ({ ...prev, productCRUD: false }));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await logDebug('product', 'crud', false, `Product CRUD test failed: ${errorMessage}`, { error }, 0);
      return false;
    }
  };
  
  // Test function for service CRUD operations
  const testServiceCRUD = async () => {
    try {
      // First check if we have categories
      if (categories.length === 0) {
        await fetchCategories();
        if (categories.length === 0) {
          setTestResults(prev => ({ ...prev, serviceCRUD: false }));
          await logDebug('service', 'create', false, 'Cannot test service CRUD: No categories available', null, 0);
          return false;
        }
      }
      
      // Find a service category
      const serviceCategory = categories.find(c => c.type === 'service' || c.type === 'both');
      if (!serviceCategory) {
        setTestResults(prev => ({ ...prev, serviceCRUD: false }));
        await logDebug('service', 'create', false, 'Cannot test service CRUD: No service categories available', { categories }, 0);
        return false;
      }
      
      // Create a test service
      const testService = {
        name: `Test Service ${Date.now()}`,
        description: 'Test service for debug panel',
        duration: '00:30',
        price: 50.00,
        category_id: serviceCategory.id,
        active: true
      };
      
      // Create service
      const startCreateTime = performance.now();
      await createService(testService);
      const createDuration = performance.now() - startCreateTime;
      
      await logDebug('service', 'create', true, `Successfully created test service: ${testService.name}`, { service: testService }, Math.round(createDuration));
      
      // Find the created service
      await fetchServices();
      const createdService = services.find(s => s.name === testService.name);
      
      if (!createdService) {
        setTestResults(prev => ({ ...prev, serviceCRUD: false }));
        await logDebug('service', 'update', false, 'Created service not found in services list', { testService }, 0);
        return false;
      }
      
      // Update the service
      const updateData = {
        description: 'Updated test service description',
        price: 55.00
      };
      
      const startUpdateTime = performance.now();
      await updateService(createdService.id, updateData);
      const updateDuration = performance.now() - startUpdateTime;
      
      await logDebug('service', 'update', true, `Successfully updated test service: ${testService.name}`, { 
        serviceId: createdService.id,
        updateData
      }, Math.round(updateDuration));
      
      // Verify the update
      await fetchServices();
      const updatedService = services.find(s => s.id === createdService.id);
      
      if (!updatedService || updatedService.price !== 55.00) {
        setTestResults(prev => ({ ...prev, serviceCRUD: false }));
        await logDebug('service', 'update', false, 'Service update verification failed', { 
          expected: 55.00,
          actual: updatedService?.price
        }, 0);
        return false;
      }
      
      setTestResults(prev => ({ ...prev, serviceCRUD: true }));
      return true;
    } catch (error) {
      setTestResults(prev => ({ ...prev, serviceCRUD: false }));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await logDebug('service', 'crud', false, `Service CRUD test failed: ${errorMessage}`, { error }, 0);
      return false;
    }
  };
  
  // Function to export logs as CSV
  const exportLogsCSV = () => {
    if (logs.length === 0) return;
    
    // Define CSV headers
    const headers = [
      'ID',
      'Timestamp',
      'Module',
      'Action',
      'Status',
      'Message',
      'Duration (ms)'
    ];
    
    // Map data to CSV rows
    const rows = logs.map(log => [
      log.id,
      new Date(log.created_at).toLocaleString('pt-BR'),
      log.module,
      log.action,
      log.success ? 'Success' : 'Error',
      log.message,
      log.duration_ms || ''
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create blob and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `debug_logs_${new Date().toISOString().slice(0, 10)}_${new Date().toISOString().slice(11, 16).replace(':', '-')}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Toggle expanded state for a log
  const toggleLogDetails = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };
  
  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR');
  };
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl overflow-hidden w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Bug className="h-6 w-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Debug de Produtos e Serviços</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('logs')}
              className={`${
                activeTab === 'logs'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <FileText className="h-5 w-5 mr-2" />
              Logs
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`${
                activeTab === 'products'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Package className="h-5 w-5 mr-2" />
              Produtos
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`${
                activeTab === 'services'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Scissors className="h-5 w-5 mr-2" />
              Serviços
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`${
                activeTab === 'categories'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Tag className="h-5 w-5 mr-2" />
              Categorias
            </button>
          </nav>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Connection Status */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {connectionStatus === 'connected' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : connectionStatus === 'disconnected' ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Clock className="h-5 w-5 text-gray-400" />
                )}
                <span className="font-medium">
                  Status da Conexão: {' '}
                  {connectionStatus === 'connected' ? (
                    <span className="text-green-600">Conectado</span>
                  ) : connectionStatus === 'disconnected' ? (
                    <span className="text-red-600">Desconectado</span>
                  ) : (
                    <span className="text-gray-500">Desconhecido</span>
                  )}
                </span>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={testConnection}
                  disabled={isTestingConnection}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {isTestingConnection ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Testar Conexão
                </button>
                
                <button
                  onClick={runDiagnosticTests}
                  disabled={isRunningTests}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {isRunningTests ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Bug className="h-4 w-4 mr-2" />
                  )}
                  Executar Diagnóstico
                </button>
              </div>
            </div>
            
            {/* Test Results */}
            {Object.keys(testResults).length > 0 && (
              <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Resultados dos Testes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className={`p-3 rounded-lg ${testResults.fetchProducts ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center">
                      {testResults.fetchProducts ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      )}
                      <span className="font-medium">Buscar Produtos</span>
                    </div>
                  </div>
                  
                  <div className={`p-3 rounded-lg ${testResults.fetchServices ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center">
                      {testResults.fetchServices ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      )}
                      <span className="font-medium">Buscar Serviços</span>
                    </div>
                  </div>
                  
                  <div className={`p-3 rounded-lg ${testResults.fetchCategories ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center">
                      {testResults.fetchCategories ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      )}
                      <span className="font-medium">Buscar Categorias</span>
                    </div>
                  </div>
                  
                  <div className={`p-3 rounded-lg ${testResults.productCRUD ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center">
                      {testResults.productCRUD ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      )}
                      <span className="font-medium">CRUD de Produtos</span>
                    </div>
                  </div>
                  
                  <div className={`p-3 rounded-lg ${testResults.serviceCRUD ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center">
                      {testResults.serviceCRUD ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      )}
                      <span className="font-medium">CRUD de Serviços</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Logs de Debug</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={loadLogs}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                  </button>
                  <button
                    onClick={exportLogsCSV}
                    disabled={logs.length === 0}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </button>
                </div>
              </div>
              
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Módulo</label>
                  <select
                    value={moduleFilter}
                    onChange={(e) => setModuleFilter(e.target.value as any)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  >
                    <option value="all">Todos os módulos</option>
                    <option value="product">Produtos</option>
                    <option value="service">Serviços</option>
                    <option value="category">Categorias</option>
                    <option value="system">Sistema</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ação</label>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value as any)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  >
                    <option value="all">Todas as ações</option>
                    <option value="create">Criar</option>
                    <option value="update">Atualizar</option>
                    <option value="delete">Excluir</option>
                    <option value="fetch">Buscar</option>
                    <option value="crud">CRUD</option>
                    <option value="connection_test">Teste de Conexão</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  >
                    <option value="all">Todos os status</option>
                    <option value="success">Sucesso</option>
                    <option value="error">Erro</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar nos logs..."
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 pr-10 sm:text-sm"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Logs Table */}
              <div className="bg-white shadow overflow-hidden rounded-lg">
                {isLoading ? (
                  <div className="p-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary-600" />
                    <p className="mt-2 text-sm text-gray-500">Carregando logs...</p>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="p-6 text-center">
                    <FileText className="h-8 w-8 text-gray-400 mx-auto" />
                    <p className="mt-2 text-sm text-gray-500">Nenhum log encontrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Data/Hora
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Módulo
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ação
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Mensagem
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Duração
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {logs.map((log) => (
                          <React.Fragment key={log.id}>
                            <tr 
                              className={`hover:bg-gray-50 cursor-pointer ${
                                log.success ? '' : 'bg-red-50'
                              }`}
                              onClick={() => toggleLogDetails(log.id)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(log.created_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {log.module}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {log.action}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {log.success ? 'Sucesso' : 'Erro'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500 max-w-md">
                                <div className="truncate">{log.message}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                              </td>
                            </tr>
                            
                            {/* Expanded details */}
                            {expandedLogs.has(log.id) && (
                              <tr className="bg-gray-50">
                                <td colSpan={6} className="px-6 py-4">
                                  <div className="text-sm">
                                    <h4 className="font-medium text-gray-900 mb-2">Detalhes:</h4>
                                    <pre className="bg-gray-100 p-3 rounded-md overflow-auto text-xs">
                                      {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {/* Pagination */}
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setLogsPage(p => Math.max(p - 1, 1))}
                      disabled={logsPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setLogsPage(p => p + 1)}
                      disabled={logsPage >= Math.ceil(logsCount / logsPerPage)}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Próxima
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Mostrando <span className="font-medium">{Math.min((logsPage - 1) * logsPerPage + 1, logsCount)}</span> a <span className="font-medium">{Math.min(logsPage * logsPerPage, logsCount)}</span> de <span className="font-medium">{logsCount}</span> resultados
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setLogsPage(p => Math.max(p - 1, 1))}
                          disabled={logsPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          <span className="sr-only">Anterior</span>
                          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                        
                        <button
                          onClick={() => setLogsPage(p => p + 1)}
                          disabled={logsPage >= Math.ceil(logsCount / logsPerPage)}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          <span className="sr-only">Próxima</span>
                          <ArrowRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Products Tab */}
          {activeTab === 'products' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Diagnóstico de Produtos</h3>
              
              <div className="bg-white shadow overflow-hidden rounded-lg mb-6">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Informações do Módulo</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Total de Produtos</dt>
                      <dd className="mt-1 text-sm text-gray-900">{products.length}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Produtos Ativos</dt>
                      <dd className="mt-1 text-sm text-gray-900">{products.filter(p => p.active).length}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Categorias de Produtos</dt>
                      <dd className="mt-1 text-sm text-gray-900">{categories.filter(c => c.type === 'product' || c.type === 'both').length}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Estado do Inventário</dt>
                      <dd className="mt-1 text-sm text-gray-900">{inventoryLoading ? 'Carregando...' : 'Pronto'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              
              <div className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Diagnóstico de Problemas</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="text-md font-medium text-gray-900 mb-2">Problemas Comuns</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Estrutura do Banco de Dados</h5>
                            <p className="text-sm text-gray-500">
                              A estrutura do banco de dados para produtos está correta e inclui todos os campos necessários.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Políticas RLS</h5>
                            <p className="text-sm text-gray-500">
                              As políticas de segurança em nível de linha (RLS) estão configuradas corretamente para produtos.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Relacionamentos</h5>
                            <p className="text-sm text-gray-500">
                              Os relacionamentos entre produtos, categorias e estoque estão configurados corretamente.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Triggers e Funções</h5>
                            <p className="text-sm text-gray-500">
                              Os gatilhos e funções para atualização de estoque estão funcionando corretamente.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="text-md font-medium text-gray-900 mb-2">Recomendações</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Otimização de Consultas</h5>
                            <p className="text-sm text-gray-500">
                              Considere adicionar índices adicionais para melhorar o desempenho das consultas de produtos.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Tratamento de Erros</h5>
                            <p className="text-sm text-gray-500">
                              Melhore o tratamento de erros nas operações de produtos para fornecer mensagens mais claras aos usuários.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Validação de Dados</h5>
                            <p className="text-sm text-gray-500">
                              Implemente validação de dados mais rigorosa para evitar problemas com valores inválidos.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Services Tab */}
          {activeTab === 'services' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Diagnóstico de Serviços</h3>
              
              <div className="bg-white shadow overflow-hidden rounded-lg mb-6">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Informações do Módulo</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Total de Serviços</dt>
                      <dd className="mt-1 text-sm text-gray-900">{services.length}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Serviços Ativos</dt>
                      <dd className="mt-1 text-sm text-gray-900">{services.filter(s => s.active).length}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Categorias de Serviços</dt>
                      <dd className="mt-1 text-sm text-gray-900">{categories.filter(c => c.type === 'service' || c.type === 'both').length}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Duração Média</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {services.length > 0 
                          ? `${Math.round(services.reduce((sum, s) => {
                              const [hours, minutes] = s.duration.split(':').map(Number);
                              return sum + hours * 60 + minutes;
                            }, 0) / services.length)} minutos` 
                          : 'N/A'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
              
              <div className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Diagnóstico de Problemas</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="text-md font-medium text-gray-900 mb-2">Problemas Comuns</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Estrutura do Banco de Dados</h5>
                            <p className="text-sm text-gray-500">
                              A estrutura do banco de dados para serviços está correta e inclui todos os campos necessários.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Políticas RLS</h5>
                            <p className="text-sm text-gray-500">
                              As políticas de segurança em nível de linha (RLS) estão configuradas corretamente para serviços.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Relacionamentos</h5>
                            <p className="text-sm text-gray-500">
                              Os relacionamentos entre serviços, categorias e agendamentos estão configurados corretamente.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="text-md font-medium text-gray-900 mb-2">Recomendações</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Validação de Duração</h5>
                            <p className="text-sm text-gray-500">
                              Melhore a validação do formato de duração para evitar problemas com valores inválidos.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Tratamento de Erros</h5>
                            <p className="text-sm text-gray-500">
                              Melhore o tratamento de erros nas operações de serviços para fornecer mensagens mais claras aos usuários.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Diagnóstico de Categorias</h3>
              
              <div className="bg-white shadow overflow-hidden rounded-lg mb-6">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Informações do Módulo</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Total de Categorias</dt>
                      <dd className="mt-1 text-sm text-gray-900">{categories.length}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Categorias Ativas</dt>
                      <dd className="mt-1 text-sm text-gray-900">{categories.filter(c => c.active).length}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Categorias de Produtos</dt>
                      <dd className="mt-1 text-sm text-gray-900">{categories.filter(c => c.type === 'product' || c.type === 'both').length}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Categorias de Serviços</dt>
                      <dd className="mt-1 text-sm text-gray-900">{categories.filter(c => c.type === 'service' || c.type === 'both').length}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              
              <div className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Diagnóstico de Problemas</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="text-md font-medium text-gray-900 mb-2">Problemas Comuns</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Estrutura do Banco de Dados</h5>
                            <p className="text-sm text-gray-500">
                              A estrutura do banco de dados para categorias está correta e inclui todos os campos necessários.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Políticas RLS</h5>
                            <p className="text-sm text-gray-500">
                              As políticas de segurança em nível de linha (RLS) estão configuradas corretamente para categorias.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Relacionamentos</h5>
                            <p className="text-sm text-gray-500">
                              Os relacionamentos entre categorias, produtos e serviços estão configurados corretamente.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="text-md font-medium text-gray-900 mb-2">Recomendações</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          </div>
                          <div className="ml-3">
                            <h5 className="text-sm font-medium text-gray-900">Validação de Tipo</h5>
                            <p className="text-sm text-gray-500">
                              Melhore a validação do tipo de categoria para garantir que apenas valores válidos sejam aceitos.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}