import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { getCurrentUser, handleInvalidSession, updateLandlordSubscription } from '../../lib/supabaseClient';
import { useCallback } from 'react';

export default function PremiumScreen() {
  const [selectedPlan, setSelectedPlan] = useState('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const ignoreParentPress = useRef(false);
  const [previewPlan, setPreviewPlan] = useState(selectedPlan);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    setPreviewPlan(selectedPlan);
  }, [selectedPlan]);

  useFocusEffect(
    useCallback(() => {
      initializeScreen();
    }, [])
  );

  const initializeScreen = async () => {
    try {
      setIsInitializing(true);
      const user = await getCurrentUser();
      
      // If no user is found, redirect to login
      if (!user) {
        Alert.alert('Session Expired', 'Your session has expired. Please log in again.', [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)'),
          },
        ]);
        return;
      }
      
      setCurrentUser(user);
      setIsInitializing(false);
    } catch (error) {
      console.error('Error initializing premium screen:', error);
      
      // Handle refresh token errors
      if (error.message && (error.message.includes('Refresh Token') || error.message.includes('Invalid'))) {
        await handleInvalidSession();
        Alert.alert('Session Expired', 'Your session has expired. Please log in again.', [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)'),
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to load premium features. Please try again.');
      }
      setIsInitializing(false);
    }
  };

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: 'Free',
      period: '',
      description: 'Perfect for getting started',
      features: [
        { text: 'List up to 2 properties', included: true },
        { text: 'Basic analytics', included: true },
        { text: 'Standard support', included: true },
        { text: 'Priority listing', included: false },
        { text: 'Advanced analytics', included: false },
      ],
      color: '#6b7280',
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '₱299',
      period: '/month',
      description: 'Best for growing landlords',
      features: [
        { text: 'List up to 10 properties', included: true },
        { text: 'Advanced analytics', included: true },
        { text: 'Priority support', included: true },
        { text: 'Priority listing', included: true },
      ],
      color: '#667eea',
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '₱799',
      period: '/month',
      description: 'For professional property managers',
      features: [
        { text: 'Unlimited properties', included: true },
        { text: 'Full analytics suite', included: true },
        { text: '24/7 dedicated support', included: true },
        { text: 'Priority listing', included: true },
      ],
      color: '#10b981',
      popular: false,
    },
  ];

  const planOrder = {
    basic: 0,
    pro: 1,
    enterprise: 2,
  };

  const handleSubscribe = (plan) => {
    if (plan.id === 'basic') {
      Alert.alert('Current Plan', 'You are already on the Basic plan.');
      return;
    }

    Alert.alert(
      'Subscribe to ' + plan.name,
      `You will be charged ${plan.price}${plan.period}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Subscribe',
          onPress: async () => {
            setIsLoading(true);
            try {
              // Persist subscription to Supabase
              const { success, error } = await updateLandlordSubscription(currentUser.id, plan.id);
              
              if (success) {
                // mark plan as current
                setSelectedPlan(plan.id);
                setIsLoading(false);
                Alert.alert(
                  'Subscription Successful!',
                  `You are now subscribed to the ${plan.name} plan. Enjoy your premium features!`,
                  [{ text: 'OK' }]
                );
              } else {
                setIsLoading(false);
                Alert.alert('Error', error || 'Failed to update subscription. Please try again.');
              }
            } catch (err) {
              setIsLoading(false);
              console.error('Subscription error:', err);
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCancelPlan = (plan) => {
    Alert.alert(
      `Cancel ${plan.name}`,
      `Are you sure you want to cancel your ${plan.name} plan and revert to Basic?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              // Persist cancellation to Supabase
              const { success, error } = await updateLandlordSubscription(currentUser.id, 'basic');
              
              if (success) {
                setSelectedPlan('basic');
                setIsLoading(false);
                Alert.alert('Cancelled', `Your ${plan.name} plan has been cancelled and reverted to Basic.`);
              } else {
                setIsLoading(false);
                Alert.alert('Error', error || 'Failed to cancel subscription. Please try again.');
              }
            } catch (err) {
              setIsLoading(false);
              console.error('Cancel plan error:', err);
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderFeature = (feature, index) => (
    <View key={index} style={styles.featureRow}>
      <Ionicons
        name={feature.included ? 'checkmark-circle' : 'close-circle'}
        size={20}
        color={feature.included ? '#10b981' : '#d1d5db'}
      />
      <Text style={[styles.featureText, !feature.included && styles.featureTextDisabled]}>
        {feature.text}
      </Text>
    </View>
  );

  const renderPlanCard = (plan) => (
    <TouchableOpacity
      key={plan.id}
      style={[
        styles.planCard,
        previewPlan === plan.id && styles.planCardSelected,
        plan.popular && styles.planCardPopular,
      ]}
      onPress={() => {
        if (ignoreParentPress.current) {
          ignoreParentPress.current = false;
          return;
        }
        // only preview the plan when tapping the card; subscribing happens via button
        setPreviewPlan(plan.id);
      }}
      activeOpacity={0.8}
    >
      {plan.popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>MOST POPULAR</Text>
        </View>
      )}

      <View style={styles.planHeader}>
        <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
        <View style={styles.priceContainer}>
          <Text style={styles.planPrice}>{plan.price}</Text>
          {plan.period && <Text style={styles.planPeriod}>{plan.period}</Text>}
        </View>
        <Text style={styles.planDescription}>{plan.description}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.featuresContainer}>
        {plan.features.map((feature, index) => renderFeature(feature, index))}
      </View>

      <TouchableOpacity
        style={[
          styles.subscribeButton,
          { backgroundColor: plan.color },
          plan.id === 'basic' && styles.subscribeButtonDisabled,
        ]}
        onPressIn={() => (ignoreParentPress.current = true)}
        onPressOut={() => (ignoreParentPress.current = false)}
        onPress={() => {
          const currentRank = planOrder[selectedPlan] ?? 0;
          const planRank = planOrder[plan.id] ?? 0;
          const isCurrent = selectedPlan === plan.id;
          const canSubscribe = planRank > currentRank;
          const canCancel = isCurrent && plan.id !== 'basic';

          if (canCancel) {
            handleCancelPlan(plan);
            return;
          }

          if (canSubscribe) {
            handleSubscribe(plan);
            return;
          }

          // otherwise do nothing (disabled)
        }}
        disabled={isLoading || (!(planOrder[plan.id] > (planOrder[selectedPlan] ?? 0)) && !(selectedPlan === plan.id && plan.id !== 'basic'))}
      >
        {isLoading && selectedPlan === plan.id ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text style={styles.subscribeButtonText}>
            {selectedPlan === plan.id
              ? plan.id === 'basic'
                ? 'Current Plan'
                : 'Cancel Plan'
              : (planOrder[plan.id] > (planOrder[selectedPlan] ?? 0) ? 'Subscribe' : 'Locked')}
          </Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium Plans</Text>
        <View style={styles.placeholder} />
      </View>

      {isInitializing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <Ionicons name="diamond" size={48} color="#667eea" />
          </View>
          <Text style={styles.heroTitle}>Upgrade Your Experience</Text>
          <Text style={styles.heroSubtitle}>
            Unlock premium features to grow your rental business and reach more tenants
          </Text>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <View style={styles.benefitItem}>
            <Ionicons name="trending-up" size={24} color="#667eea" />
            <Text style={styles.benefitText}>Increase Visibility</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="analytics" size={24} color="#667eea" />
            <Text style={styles.benefitText}>Better Insights</Text>
          </View>
        </View>

        {/* Plans */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => renderPlanCard(plan))}
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I cancel anytime?</Text>
            <Text style={styles.faqAnswer}>
              Yes, you can cancel your subscription at any time. Your premium features will remain active until the end of your billing period.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How does billing work?</Text>
            <Text style={styles.faqAnswer}>
              You'll be billed monthly on the same date you subscribed. We accept all major payment methods.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I upgrade or downgrade?</Text>
            <Text style={styles.faqAnswer}>
              You can change your plan at any time. Upgrades take effect immediately, while downgrades apply at the next billing cycle.
            </Text>
          </View>
        </View>

        {/* Contact Support */}
        <TouchableOpacity 
          style={styles.supportButton}
          onPress={() => router.push('/landlord/support')}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#667eea" />
          <Text style={styles.supportButtonText}>Have questions? Contact Support</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: 'white',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f1ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  benefitsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  benefitItem: {
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  plansContainer: {
    padding: 20,
    gap: 16,
  },
  planCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  planCardSelected: {
    borderColor: '#667eea',
  },
  planCardPopular: {
    borderColor: '#667eea',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  planPeriod: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  planDescription: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e5e5',
    marginVertical: 16,
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  featureTextDisabled: {
    color: '#9ca3af',
  },
  subscribeButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  subscribeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  faqSection: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  faqTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginHorizontal: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  supportButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 40,
  },
});
