# WhatChanged Manual Testing Scenarios

This document provides comprehensive manual testing scenarios for the WhatChanged SEC filing analysis platform.

## Overview

These manual testing scenarios cover the complete user journey from registration through advanced features. Each scenario includes detailed steps, expected results, and validation criteria.

## Prerequisites

Before starting manual testing:

1. **Environment Setup**
   - Application running locally or in staging environment
   - Database populated with sample data
   - External API keys configured (SEC, OpenAI, Stripe, etc.)
   - Email/SMS services configured for testing

2. **Test Data Requirements**
   - At least 5 companies with recent SEC filings
   - Sample user accounts with different subscription tiers
   - Test payment methods for Stripe integration
   - Mock data for development/staging environments

3. **Browser Requirements**
   - Chrome (latest)
   - Firefox (latest)
   - Safari (if testing on macOS)
   - Mobile browsers for responsive testing

## Test Scenarios

### 1. User Registration and Authentication

#### Scenario 1.1: New User Registration
**Objective**: Verify new users can register successfully

**Preconditions**: 
- Clear browser cookies/session
- Valid email address for testing

**Test Steps**:
1. Navigate to the application homepage
2. Click "Sign Up" or "Get Started" button
3. Fill in registration form:
   - Email: `test+${timestamp}@example.com`
   - Name: "Test User"
   - Password: "SecurePass123!"
   - Confirm password: "SecurePass123!"
4. Check "I agree to Terms of Service" checkbox
5. Click "Create Account" button
6. Check email for verification link
7. Click verification link in email
8. Complete profile setup if prompted

**Expected Results**:
- ✅ User successfully redirected to verification page
- ✅ Verification email received within 1 minute
- ✅ Email verification link works correctly
- ✅ User can log in after verification
- ✅ Welcome/onboarding flow appears

**Validation Criteria**:
- User record created in database
- Email verification status updated
- User session established correctly

#### Scenario 1.2: User Login
**Objective**: Verify existing users can log in

**Test Steps**:
1. Navigate to login page
2. Enter valid credentials
3. Click "Sign In"
4. Verify dashboard loads

**Expected Results**:
- ✅ Successful authentication
- ✅ Redirect to dashboard
- ✅ User session persisted

#### Scenario 1.3: Password Reset
**Objective**: Verify password reset functionality

**Test Steps**:
1. Go to login page
2. Click "Forgot Password?"
3. Enter registered email
4. Check email for reset link
5. Follow reset instructions
6. Set new password
7. Log in with new password

**Expected Results**:
- ✅ Reset email received
- ✅ Password successfully updated
- ✅ Can log in with new credentials

### 2. Company Search and Overview

#### Scenario 2.1: Company Search
**Objective**: Verify users can search for companies

**Test Steps**:
1. From dashboard, locate search functionality
2. Enter company ticker (e.g., "AAPL")
3. Press Enter or click search button
4. Review search results
5. Click on a company from results

**Expected Results**:
- ✅ Search returns relevant results
- ✅ Company information displayed accurately
- ✅ Navigation to company detail page works

#### Scenario 2.2: Stock Overview Page
**Objective**: Verify company overview page loads and displays correctly

**Test Steps**:
1. Navigate to `/stocks/AAPL` (or any valid ticker)
2. Wait for page to load (should be <2 seconds)
3. Verify all sections load:
   - Company header with ticker and name
   - Current price data (if available)
   - Latest filing summary
   - Recent filings list
   - Material changes (if any)
4. Test responsive design on different screen sizes

**Expected Results**:
- ✅ Page loads within 2 seconds
- ✅ All data sections populated correctly
- ✅ Charts and visualizations render properly
- ✅ Mobile responsive design works

#### Scenario 2.3: Filing Details
**Objective**: Verify filing detail pages work correctly

**Test Steps**:
1. From company overview, click on a recent filing
2. Review filing detail page:
   - Form type and filing date
   - Executive summary
   - Key highlights
   - Material changes (if any)
   - Diff visualization
3. Test navigation back to company overview

**Expected Results**:
- ✅ Filing details load correctly
- ✅ Summary and highlights are coherent
- ✅ Diff visualization (if available) is readable
- ✅ Navigation works properly

### 3. Watchlist Management

#### Scenario 3.1: Add Company to Watchlist
**Objective**: Verify users can add companies to watchlist

**Test Steps**:
1. Navigate to a company overview page
2. Click "Add to Watchlist" button
3. Configure alert settings:
   - Select alert types (Material Changes, New Filings, etc.)
   - Choose notification methods (Email, SMS if available)
   - Set materiality threshold
4. Save watchlist settings
5. Verify company appears in user's watchlist

**Expected Results**:
- ✅ Company successfully added to watchlist
- ✅ Alert preferences saved correctly
- ✅ Watchlist updated in user dashboard

#### Scenario 3.2: Manage Watchlist
**Objective**: Verify watchlist management functionality

**Test Steps**:
1. Go to dashboard/watchlist section
2. View all watched companies
3. Edit settings for a watched company
4. Remove a company from watchlist
5. Verify changes are persistent

**Expected Results**:
- ✅ Watchlist displays all companies
- ✅ Edit functionality works
- ✅ Removal works correctly
- ✅ Changes persist across sessions

### 4. Alert System

#### Scenario 4.1: Alert Configuration
**Objective**: Verify alert settings can be configured

**Test Steps**:
1. Navigate to alert settings page
2. Configure global alert preferences:
   - Email notifications: Enable
   - SMS notifications: Enable (if available)
   - Materiality threshold: Set to 0.7
   - Form types: Select 10-K, 10-Q, 8-K
3. Save settings
4. Test notification preferences

**Expected Results**:
- ✅ Settings saved successfully
- ✅ Preferences applied to new alerts
- ✅ Notification methods work (send test alerts)

#### Scenario 4.2: Alert Reception
**Objective**: Verify alerts are received correctly

**Preconditions**: 
- Company in watchlist with alerts enabled
- Recent material filing available

**Test Steps**:
1. Trigger alert conditions (may require waiting for real filings or using test data)
2. Check email for alert notifications
3. Check SMS (if configured) for alerts
4. Review in-app alerts/notifications
5. Verify alert content is accurate and actionable

**Expected Results**:
- ✅ Email alerts received within expected timeframe
- ✅ SMS alerts received (if configured)
- ✅ Alert content is accurate and helpful
- ✅ Links in alerts work correctly

### 5. Dashboard Functionality

#### Scenario 5.1: Dashboard Overview
**Objective**: Verify dashboard displays user's data correctly

**Test Steps**:
1. Log in and navigate to dashboard
2. Review all dashboard sections:
   - Recent activity feed
   - Watchlist summary
   - Recent alerts
   - Market overview (if available)
   - Account status
3. Test interactive elements
4. Verify data refresh functionality

**Expected Results**:
- ✅ Dashboard loads quickly (<3 seconds)
- ✅ All sections populate with relevant data
- ✅ Interactive elements respond correctly
- ✅ Data reflects user's actual activity

#### Scenario 5.2: Activity Feed
**Objective**: Verify activity feed shows recent events

**Test Steps**:
1. Perform various actions (add to watchlist, view filings, etc.)
2. Check if actions appear in activity feed
3. Verify timestamps and descriptions are accurate
4. Test feed pagination (if implemented)

**Expected Results**:
- ✅ Recent actions appear in feed
- ✅ Timestamps are accurate
- ✅ Descriptions are clear and helpful

### 6. Subscription and Billing

#### Scenario 6.1: Subscription Upgrade
**Objective**: Verify subscription upgrade process

**Preconditions**:
- Free tier user account
- Test Stripe account configured

**Test Steps**:
1. Navigate to subscription/billing page
2. Review available plans
3. Click "Upgrade" on a paid plan
4. Complete payment process using test card:
   - Card: 4242 4242 4242 4242
   - Expiry: Any future date
   - CVC: Any 3 digits
5. Verify subscription activation
6. Check new feature access

**Expected Results**:
- ✅ Payment process completes successfully
- ✅ Subscription status updated
- ✅ New features become accessible
- ✅ Billing information recorded correctly

#### Scenario 6.2: Subscription Management
**Objective**: Verify subscription management features

**Test Steps**:
1. Access billing/subscription page
2. Review current plan details
3. Update billing information
4. Download invoice (if available)
5. Test plan changes (upgrade/downgrade)

**Expected Results**:
- ✅ Current subscription displayed accurately
- ✅ Billing information can be updated
- ✅ Invoices are accessible
- ✅ Plan changes work correctly

### 7. API Integration Testing

#### Scenario 7.1: SEC Data Integration
**Objective**: Verify SEC filing data integration

**Test Steps**:
1. Search for a company with recent SEC filings
2. Verify filing data accuracy:
   - Form types correct
   - Filing dates accurate
   - Company information matches SEC records
3. Check data freshness (filings should be recent)
4. Test filing ingestion process (if admin access available)

**Expected Results**:
- ✅ SEC data matches official records
- ✅ Filings are processed correctly
- ✅ Data updates regularly
- ✅ No data corruption or formatting issues

#### Scenario 7.2: AI Analysis Verification
**Objective**: Verify AI-powered analysis features

**Test Steps**:
1. View analysis for recent filings
2. Check summary quality and accuracy
3. Verify key highlights extraction
4. Review materiality scoring
5. Compare AI analysis with manual review (sample)

**Expected Results**:
- ✅ Summaries are coherent and accurate
- ✅ Key highlights are relevant
- ✅ Materiality scores seem reasonable
- ✅ Analysis adds value over raw filings

### 8. Performance Testing

#### Scenario 8.1: Page Load Performance
**Objective**: Verify pages load within performance targets

**Test Steps**:
1. Clear browser cache
2. Navigate to key pages and measure load times:
   - Homepage: Target <1.5s
   - Stock overview: Target <2s
   - Dashboard: Target <2.5s
   - Filing details: Target <3s
3. Test on different network conditions (3G, WiFi)
4. Check performance on mobile devices

**Expected Results**:
- ✅ All pages meet load time targets
- ✅ Performance acceptable on slower connections
- ✅ Mobile performance is adequate

#### Scenario 8.2: Concurrent User Simulation
**Objective**: Verify system handles multiple concurrent users

**Test Steps**:
1. Open multiple browser sessions/tabs
2. Log in with different user accounts
3. Perform various actions simultaneously
4. Monitor for performance degradation
5. Check for any errors or timeouts

**Expected Results**:
- ✅ System handles concurrent users smoothly
- ✅ No significant performance degradation
- ✅ No errors or timeouts occur

### 9. Mobile Responsiveness

#### Scenario 9.1: Mobile User Experience
**Objective**: Verify mobile experience is functional and usable

**Test Steps**:
1. Access application on mobile browser
2. Test core functionality:
   - Login/registration
   - Company search
   - Watchlist management
   - Alert settings
   - Dashboard navigation
3. Check touch interactions
4. Verify responsive design

**Expected Results**:
- ✅ All core features work on mobile
- ✅ Touch interactions are responsive
- ✅ Layout adapts appropriately
- ✅ Text is readable without zooming

### 10. Error Handling and Edge Cases

#### Scenario 10.1: Network Error Handling
**Objective**: Verify graceful handling of network issues

**Test Steps**:
1. Simulate network interruption during key actions
2. Test behavior with slow network connections
3. Verify error messages are helpful
4. Check recovery when network restored

**Expected Results**:
- ✅ Appropriate error messages displayed
- ✅ User can retry failed actions
- ✅ Application recovers gracefully
- ✅ No data loss occurs

#### Scenario 10.2: Invalid Input Handling
**Objective**: Verify proper validation and error handling

**Test Steps**:
1. Test forms with invalid inputs:
   - Invalid email formats
   - Weak passwords
   - Invalid ticker symbols
   - Special characters in text fields
2. Verify validation messages are clear
3. Test SQL injection attempts (security)

**Expected Results**:
- ✅ Invalid inputs are rejected with clear messages
- ✅ Security vulnerabilities are prevented
- ✅ User guided to correct input format

## Test Execution Guidelines

### Test Environment Setup

1. **Data Preparation**
   ```bash
   # Reset test database
   npm run db:reset:test
   
   # Seed with test data
   npm run db:seed:test
   ```

2. **Environment Variables**
   ```bash
   # Set test environment
   export NODE_ENV=testing
   export USE_TEST_DATA=true
   ```

### Test Execution Checklist

- [ ] All critical path scenarios pass
- [ ] Performance targets met
- [ ] Mobile responsiveness verified
- [ ] Error handling tested
- [ ] Security measures validated
- [ ] Integration points working
- [ ] User experience is intuitive

### Bug Reporting Template

When bugs are found during manual testing:

```markdown
**Bug Title**: Brief description

**Environment**: staging/production/local

**Steps to Reproduce**:
1. Step one
2. Step two
3. Step three

**Expected Result**: What should happen

**Actual Result**: What actually happened

**Severity**: Critical/High/Medium/Low

**Screenshots**: Attach if applicable

**Additional Notes**: Any other relevant information
```

### Test Sign-off Criteria

Before considering manual testing complete:

1. ✅ All critical scenarios pass
2. ✅ No blocking bugs identified
3. ✅ Performance meets requirements
4. ✅ Security testing completed
5. ✅ Cross-browser compatibility verified
6. ✅ Mobile experience validated
7. ✅ User acceptance criteria met

## Continuous Manual Testing

### Regression Testing

Run these scenarios regularly:
- Weekly: Critical path scenarios (1, 2.1, 2.2, 3.1, 5.1)
- Monthly: Full scenario suite
- Before releases: Complete testing with focus on changed areas

### New Feature Testing

For new features:
1. Create specific test scenarios
2. Test integration with existing features
3. Verify no regression in existing functionality
4. Update this document with new scenarios

---

*This document should be updated regularly as new features are added and testing processes evolve.*