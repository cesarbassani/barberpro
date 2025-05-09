import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  FileText, 
  Download, 
  Calendar, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Package, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { useInventory, type BelowReorderPoint, type InventoryTurnover } from '../../lib/inventory';
import { useProducts } from '../../lib/products';
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function InventoryReports() {
  const { 
    fetchProductsBelowReorderPoint, 
    fetchInventoryTurnover, 
    calculateInventoryValue,
    belowReorderPoint, 
    inventoryTurnover,
    inventoryValue,
    isLoading 
  } = useInventory();
  
  const { products } = useProducts();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'reorder' | 'turnover' | 'value'>('reorder');
  const [inventorySummary, setInventorySummary] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStockItems: 0,
    zeroStockItems: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      await fetchProductsBelowReorderPoint();
      
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      await fetchInventoryTurnover(start, end);
      
      await calculateInventoryValue();
      
      // Calculate inventory summary
      if (products.length > 0) {
        const activeProducts = products.filter(p => p.active);
        const productsWithCost = activeProducts.map(p => ({
          ...p,
          cost: p.cost_price || p.price * 0.6
        }));
        
        const totalValue = productsWithCost.reduce((sum, p) => sum + (p.stock_quantity * p.cost), 0);
        const lowStockItems = activeProducts.filter(p => p.stock_quantity <= p.min_stock_alert && p.stock_quantity > 0).length;
        const zeroStockItems = activeProducts.filter(p => p.stock_quantity === 0).length;
        
        setInventorySummary({
          totalProducts: activeProducts.length,
          totalValue,
          lowStockItems,
          zeroStockItems,
        });
      }
    };
    
    loadData();
  }, [fetchProductsBelowReorderPoint, fetchInventoryTurnover, calculateInventoryValue, currentMonth, products]);

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handleExportCsv = (type: 'reorder' | 'turnover' | 'value') => {
    let data: string[][];
    let filename: string;
    
    switch (type) {
      case 'reorder':
        data = [
          ['Produto', 'Estoque Atual', 'Estoque Mínimo', 'Ponto de Reposição', 'Última Reposição'],
          ...belowReorderPoint.map(item => [
            item.product_name,
            item.current_stock.toString(),
            '5', // We don't have min_stock_alert in the response
            item.reorder_point.toString(),
            item.last_restock_date ? format(new Date(item.last_restock_date), 'dd/MM/yyyy') : 'Nunca'
          ])
        ];
        filename = `produtos-baixo-estoque-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        break;
        
      case 'turnover':
        data = [
          ['Produto', 'Estoque Inicial', 'Estoque Final', 'Quantidade Vendida', 'Taxa de Giro'],
          ...inventoryTurnover.map(item => [
            item.product_name,
            item.beginning_inventory.toString(),
            item.ending_inventory.toString(),
            item.sales_quantity.toString(),
            item.turnover_rate.toFixed(2)
          ])
        ];
        filename = `giro-estoque-${format(currentMonth, 'yyyy-MM')}.csv`;
        break;
        
      case 'value':
        data = [
          ['Produto', 'Estoque', 'Custo Unitário', 'Valor Total'],
          ...products
            .filter(p => p.active && p.stock_quantity > 0)
            .map(p => [
              p.name,
              p.stock_quantity.toString(),
              (p.cost_price || p.price * 0.6).toFixed(2),
              (p.stock_quantity * (p.cost_price || p.price * 0.6)).toFixed(2)
            ])
        ];
        filename = `valor-estoque-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        break;
    }
    
    const csvContent = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <BarChart className="h-6 w-6 mr-2 text-primary-600" />
          Relatórios de Estoque
        </h2>
        <div>
          <button
            onClick={() => handleExportCsv(activeTab)}
            className="flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-primary-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total de Produtos</p>
              <p className="text-2xl font-semibold text-gray-900">{inventorySummary.totalProducts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Valor do Estoque</p>
              <p className="text-2xl font-semibold text-gray-900">R$ {inventoryValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Estoque Baixo</p>
              <p className="text-2xl font-semibold text-gray-900">{inventorySummary.lowStockItems} produtos</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Sem Estoque</p>
              <p className="text-2xl font-semibold text-gray-900">{inventorySummary.zeroStockItems} produtos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('reorder')}
            className={`${
              activeTab === 'reorder'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <AlertTriangle className="h-5 w-5 mr-2" />
            Produtos a Repor
          </button>
          
          <button
            onClick={() => setActiveTab('turnover')}
            className={`${
              activeTab === 'turnover'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <TrendingUp className="h-5 w-5 mr-2" />
            Giro de Estoque
          </button>
          
          <button
            onClick={() => setActiveTab('value')}
            className={`${
              activeTab === 'value'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <DollarSign className="h-5 w-5 mr-2" />
            Valor do Estoque
          </button>
        </nav>
      </div>

      {/* Report Content */}
      <div className="bg-white shadow rounded-lg">
        {/* Low Stock / Reorder Report */}
        {activeTab === 'reorder' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
                Produtos Abaixo do Ponto de Reposição
              </h3>
              <span className="text-sm text-gray-500">
                {belowReorderPoint.length} {belowReorderPoint.length === 1 ? 'produto' : 'produtos'}
              </span>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : belowReorderPoint.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Sem produtos a repor</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Todos os produtos estão com estoque adequado.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estoque Atual
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ponto de Reposição
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qtd. a Repor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Última Reposição
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {belowReorderPoint.map((item) => (
                      <tr key={item.product_id} className={item.current_stock === 0 ? 'bg-red-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.product_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.current_stock}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.reorder_point}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.reorder_point - item.current_stock}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.last_restock_date 
                            ? format(new Date(item.last_restock_date), 'dd/MM/yyyy')
                            : 'Nunca'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.current_stock === 0
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {item.current_stock === 0 ? 'Esgotado' : 'Baixo Estoque'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Inventory Turnover Report */}
        {activeTab === 'turnover' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-blue-500" />
                Giro de Estoque
              </h3>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={handlePreviousMonth}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                <button 
                  onClick={handleNextMonth}
                  className="p-1 rounded-full hover:bg-gray-100"
                  disabled={isAfter(endOfMonth(currentMonth), new Date())}
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : inventoryTurnover.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Sem dados de giro</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Não há dados de giro de estoque para o período selecionado.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estoque Inicial
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estoque Final
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vendas
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Taxa de Giro
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventoryTurnover.map((item) => (
                      <tr key={item.product_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.product_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.beginning_inventory}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.ending_inventory}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.sales_quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.turnover_rate.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.turnover_rate > 1
                              ? 'bg-green-100 text-green-800'
                              : item.turnover_rate > 0.5
                              ? 'bg-blue-100 text-blue-800'
                              : item.turnover_rate > 0
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.turnover_rate > 1
                              ? 'Alto Giro'
                              : item.turnover_rate > 0.5
                              ? 'Giro Normal'
                              : item.turnover_rate > 0
                              ? 'Baixo Giro'
                              : 'Sem Giro'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Inventory Value Report */}
        {activeTab === 'value' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-green-500" />
                Valor do Estoque
              </h3>
              <span className="text-sm font-medium text-gray-700">
                Total: <span className="text-green-600">R$ {inventoryValue.toFixed(2)}</span>
              </span>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : products.filter(p => p.active).length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Sem produtos</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Não há produtos ativos no sistema.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantidade em Estoque
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Custo Unitário
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        % do Inventário
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products
                      .filter(p => p.active && p.stock_quantity > 0)
                      .sort((a, b) => {
                        const aValue = a.stock_quantity * (a.cost_price || a.price * 0.6);
                        const bValue = b.stock_quantity * (b.cost_price || b.price * 0.6);
                        return bValue - aValue; // Sort by value, highest first
                      })
                      .map((product) => {
                        const costPrice = product.cost_price || product.price * 0.6;
                        const totalValue = product.stock_quantity * costPrice;
                        const percentOfInventory = (totalValue / inventoryValue) * 100;
                        
                        return (
                          <tr key={product.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {product.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {product.stock_quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              R$ {costPrice.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                              R$ {totalValue.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${percentOfInventory}%` }}></div>
                              </div>
                              <span className="text-xs mt-1">{percentOfInventory.toFixed(1)}%</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}