import { createCustomer, createSubscription } from './asaas';

async function runAsaasTests() {
  console.group('🧪 Running Asaas Integration Tests');
  const startTime = performance.now();
  let success = true;

  try {
    // Test 1: Create Customer
    console.log('\n📋 Test 1: Create Customer');
    const customerData = {
      name: 'Test User',
      email: 'testuser@example.com',
      phone: '999999999',
      cpfCnpj: '12345678900'
    };

    console.log('Request:', customerData);
    const customer = await createCustomer(customerData);
    console.log('Response:', customer);
    console.log('✅ Customer created successfully');

    // Test 2: Create Subscription
    console.log('\n📋 Test 2: Create Subscription');
    const subscriptionData = {
      customer: customer.id,
      value: 150,
      billingType: 'BOLETO' as const,
      description: 'Assinatura Teste',
      nextDueDate: '2025-05-01'
    };

    console.log('Request:', subscriptionData);
    const subscription = await createSubscription(subscriptionData);
    console.log('Response:', subscription);
    console.log('✅ Subscription created successfully');

  } catch (error) {
    success = false;
    console.error('❌ Test failed:', error);
  }

  const endTime = performance.now();
  const duration = Math.round(endTime - startTime);

  console.log('\n📊 Test Summary:');
  console.log(`Duration: ${duration}ms`);
  console.log(`Status: ${success ? '✅ All tests passed' : '❌ Tests failed'}`);
  console.groupEnd();
}

// Run tests
runAsaasTests();