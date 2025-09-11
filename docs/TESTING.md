# Manual Testing Scenarios for WhatChanged

This document outlines comprehensive manual testing scenarios for the WhatChanged SEC filing monitoring application. These scenarios should be executed to ensure the application functions correctly across all features and user flows.

## Prerequisites

Before starting manual testing, ensure:
- Application is running locally or on staging environment
- Test database is populated with sample data
- All required environment variables are configured
- Email and SMS testing services are configured (MailHog for development)

## Test Data Setup

### Test User Accounts
- **Free User**: `testuser@example.com` / `TestPassword123!`
- **Basic Subscriber**: `basicuser@example.com` / `TestPassword123!` 
- **Pro Subscriber**: `prouser@example.com` / `TestPassword123!`
- **Admin User**: `admin@example.com` / `AdminPassword123!`

### Test Companies
- **TESTCO** (Test Company Inc.) - Active with recent filings
- **DEMO** (Demo Corporation) - Active with material changes
- **INACTIVE** (Inactive Corp) - Inactive company

## Authentication & User Management

### T063-001: User Registration
**Objective**: Verify new user registration flow

**Steps**:
1. Navigate to registration page (`/auth/signup`)
2. Fill out registration form:
   - Name: "Test User"
   - Email: "newuser@example.com"
   - Password: "StrongPassword123!"
   - Confirm Password: "StrongPassword123!"
   - Check "Accept Terms" checkbox
3. Submit form
4. Verify success message appears
5. Check email for verification link
6. Click verification link
7. Verify email is confirmed

**Expected Results**:
- Registration successful
- Verification email sent
- Email verification completes successfully
- User can log in after verification

### T063-002: User Login
**Objective**: Verify user authentication

**Steps**:
1. Navigate to login page (`/auth/signin`)
2. Enter valid credentials
3. Click "Sign In"
4. Verify redirect to dashboard

**Expected Results**:
- Successful authentication
- Redirect to user dashboard
- User menu displays correct name

### T063-003: Password Reset
**Objective**: Verify password reset functionality

**Steps**:
1. Go to login page
2. Click "Forgot Password" link
3. Enter email address
4. Submit reset request
5. Check email for reset link
6. Click reset link
7. Enter new password
8. Submit password change
9. Attempt login with new password

**Expected Results**:
- Reset email sent successfully
- Password reset form accessible via link
- Password updated successfully
- Can log in with new password

### T063-004: Profile Management
**Objective**: Verify user can update profile information

**Steps**:
1. Log in as test user
2. Navigate to Settings > Profile
3. Update name, phone number
4. Save changes
5. Refresh page and verify changes persist

**Expected Results**:
- Profile updates saved successfully
- Changes persist after page refresh
- Success notification displayed

## Company Search & Watchlist Management

### T063-005: Company Search
**Objective**: Verify company search functionality

**Steps**:
1. Log in and go to dashboard
2. Click "Add Company" button
3. Search for "TESTCO"
4. Verify search results appear
5. Try searching by company name "Test Company"
6. Try industry filter
7. Test invalid search terms

**Expected Results**:
- Search by symbol returns results
- Search by name returns results
- Industry filter works correctly
- No results for invalid searches

### T063-006: Add Company to Watchlist
**Objective**: Verify adding companies to watchlist

**Steps**:
1. Search for a company (TESTCO)
2. Click "Add to Watchlist" button
3. Configure alert settings:
   - Enable material change alerts
   - Set materiality threshold to 0.7
4. Save watchlist entry
5. Navigate to watchlist page
6. Verify company appears in watchlist

**Expected Results**:
- Company added successfully
- Alert configuration saved
- Company visible in watchlist
- Success notification shown

### T063-007: Watchlist Limits (Free User)
**Objective**: Verify free plan watchlist limits

**Steps**:
1. Log in as free user
2. Add 3 companies to watchlist
3. Attempt to add 4th company
4. Verify limit warning appears
5. Check upgrade prompt

**Expected Results**:
- First 3 companies added successfully
- 4th company blocked with limit message
- Upgrade prompt displayed
- Current usage shown correctly

### T063-008: Remove from Watchlist
**Objective**: Verify removing companies from watchlist

**Steps**:
1. Go to watchlist page
2. Click remove button on a company
3. Confirm removal in modal
4. Verify company removed from list

**Expected Results**:
- Confirmation modal appears
- Company removed after confirmation
- Watchlist count updated
- Success notification shown

## Filing Analysis & Alerts

### T063-009: View Company Filings
**Objective**: Verify filing display and analysis

**Steps**:
1. Go to watchlist
2. Click on a company (TESTCO)
3. View recent filings list
4. Click on a specific filing
5. Review filing summary
6. Check for material changes highlighted
7. View filing diff sections

**Expected Results**:
- Recent filings displayed chronologically
- Filing details load correctly
- Summary and highlights shown
- Material changes clearly marked
- Diff sections properly formatted

### T063-010: Alert Generation
**Objective**: Verify alerts are generated for material changes

**Steps**:
1. Ensure test company has material changes
2. Navigate to Alerts page
3. Verify recent alerts appear
4. Check alert details
5. Verify alert types (material change, new filing)

**Expected Results**:
- Alerts generated for material changes
- Alert details accurate
- Different alert types distinguishable
- Alerts properly sorted by date

### T063-011: Alert Preferences
**Objective**: Verify alert configuration options

**Steps**:
1. Go to Settings > Notifications
2. Toggle email alerts on/off
3. Enable SMS alerts (if available)
4. Adjust materiality threshold
5. Enable/disable daily summary
6. Save preferences
7. Verify settings persist

**Expected Results**:
- All settings save correctly
- Changes reflect immediately
- Settings persist after logout/login
- Appropriate UI feedback shown

## Subscription & Billing

### T063-012: View Subscription Plans
**Objective**: Verify subscription plan display

**Steps**:
1. Go to Billing page
2. Review current plan details
3. View available upgrade options
4. Check pricing display
5. Review feature comparisons

**Expected Results**:
- Current plan clearly shown
- Upgrade options visible
- Pricing accurate and clear
- Feature differences highlighted

### T063-013: Subscription Upgrade Flow
**Objective**: Verify subscription upgrade process

**Steps**:
1. Click "Upgrade" on Basic plan
2. Review checkout page
3. **NOTE**: Stop before payment in test environment
4. Verify plan details are correct
5. Check pricing calculations
6. Verify return URLs configured

**Expected Results**:
- Checkout session created
- Plan details accurate
- Pricing calculations correct
- Professional appearance

### T063-014: Billing History
**Objective**: Verify billing history display

**Steps**:
1. Log in as subscriber
2. Go to Billing > History
3. Review payment records
4. Check invoice details
5. Verify download links work

**Expected Results**:
- Payment history displayed correctly
- Invoice details accurate
- Download functionality works
- Proper formatting and layout

## Premium Features

### T063-015: SMS Alerts (Premium)
**Objective**: Verify SMS functionality for premium users

**Steps**:
1. Log in as premium user
2. Add phone number in profile
3. Verify phone number via SMS
4. Enable SMS alerts
5. Trigger a test alert
6. Verify SMS received

**Expected Results**:
- Phone verification works
- SMS alerts can be enabled
- Test SMS sent successfully
- SMS content properly formatted

### T063-016: Advanced Analytics (Pro)
**Objective**: Verify pro-level analytics features

**Steps**:
1. Log in as pro user
2. Navigate to analytics section
3. Review company trend analysis
4. Check risk assessments
5. Verify data export functionality

**Expected Results**:
- Advanced charts and graphs displayed
- Data analysis accurate
- Export functionality works
- Pro-only features accessible

### T063-017: API Access (Pro)
**Objective**: Verify API access for pro users

**Steps**:
1. Log in as pro user
2. Go to Settings > API
3. Generate API key
4. Review API documentation
5. Test simple API call
6. Verify rate limits displayed

**Expected Results**:
- API key generation works
- Documentation accessible
- API calls successful
- Rate limits clearly shown

## Administrative Functions

### T063-018: Admin Dashboard
**Objective**: Verify admin-only functionality

**Steps**:
1. Log in as admin user
2. Access admin dashboard
3. Review system statistics
4. Check user management features
5. Review job queue status
6. Check system health metrics

**Expected Results**:
- Admin dashboard accessible
- System statistics accurate
- User management functional
- Health metrics displayed
- Proper admin-only access control

### T063-019: User Management (Admin)
**Objective**: Verify admin user management capabilities

**Steps**:
1. Access user management section
2. Search for users
3. View user details
4. Modify user permissions
5. Deactivate/reactivate user account

**Expected Results**:
- User search works correctly
- User details displayed accurately
- Permission changes saved
- Account status changes work

## Error Handling & Edge Cases

### T063-020: Network Error Handling
**Objective**: Verify graceful handling of network issues

**Steps**:
1. Disable network connection
2. Attempt various actions
3. Re-enable network
4. Verify recovery behavior

**Expected Results**:
- Appropriate error messages shown
- No application crashes
- Graceful recovery when network restored
- User informed of connectivity issues

### T063-021: Input Validation
**Objective**: Verify proper input validation

**Steps**:
1. Test forms with invalid data:
   - Invalid email formats
   - Weak passwords
   - Missing required fields
   - SQL injection attempts
   - XSS attempts
2. Verify error messages
3. Confirm data not saved

**Expected Results**:
- Invalid input rejected
- Clear error messages shown
- No security vulnerabilities
- Form state preserved appropriately

### T063-022: Rate Limiting
**Objective**: Verify rate limiting functionality

**Steps**:
1. Make rapid successive API calls
2. Verify rate limiting kicks in
3. Check rate limit headers
4. Wait for reset period
5. Verify access restored

**Expected Results**:
- Rate limiting enforced
- Appropriate HTTP status codes
- Clear rate limit information
- Access restored after reset

## Performance Testing

### T063-023: Page Load Performance
**Objective**: Verify acceptable page load times

**Steps**:
1. Clear browser cache
2. Navigate to dashboard
3. Measure load time
4. Load company with many filings
5. Measure filing list load time
6. Test with slow network simulation

**Expected Results**:
- Dashboard loads in < 3 seconds
- Filing lists load in < 5 seconds
- Acceptable performance on slow networks
- Loading indicators shown appropriately

### T063-024: Large Dataset Handling
**Objective**: Verify performance with large datasets

**Steps**:
1. Load company with 100+ filings
2. Scroll through filing list
3. Search within large filing content
4. Test pagination performance

**Expected Results**:
- Large lists load without timeout
- Smooth scrolling performance
- Search remains responsive
- Pagination works efficiently

## Mobile Responsiveness

### T063-025: Mobile Navigation
**Objective**: Verify mobile-friendly interface

**Steps**:
1. Access app on mobile device/emulator
2. Test navigation menu
3. Verify touch interactions
4. Test form inputs
5. Check table scrolling

**Expected Results**:
- Mobile menu works correctly
- Touch targets appropriately sized
- Forms usable on mobile
- Tables scroll horizontally
- Responsive design maintained

### T063-026: Mobile-Specific Features
**Objective**: Verify mobile-optimized features

**Steps**:
1. Test pull-to-refresh
2. Verify swipe gestures
3. Check mobile keyboard behavior
4. Test mobile notifications

**Expected Results**:
- Mobile gestures work correctly
- Keyboard doesn't obstruct content
- Notifications appear appropriately
- Performance acceptable on mobile

## Security Testing

### T063-027: Authentication Security
**Objective**: Verify authentication security measures

**Steps**:
1. Test login with incorrect credentials
2. Try accessing protected routes without login
3. Test session timeout
4. Verify logout functionality
5. Test password complexity requirements

**Expected Results**:
- Failed login attempts blocked
- Unauthorized access prevented
- Sessions timeout appropriately
- Logout clears session completely
- Password requirements enforced

### T063-028: Data Access Controls
**Objective**: Verify proper data access restrictions

**Steps**:
1. Attempt to access other users' data
2. Test API endpoints with different user roles
3. Verify admin-only functions restricted
4. Test watchlist privacy

**Expected Results**:
- Users can only access own data
- Role-based access working
- Admin functions properly restricted
- No data leakage between users

## Integration Testing

### T063-029: Email Integration
**Objective**: Verify email sending functionality

**Steps**:
1. Trigger various email types:
   - Welcome email
   - Verification email
   - Alert emails
   - Password reset
2. Check email content
3. Verify email formatting
4. Test unsubscribe links

**Expected Results**:
- All email types sent successfully
- Content accurate and formatted properly
- Unsubscribe functionality works
- Email delivery reliable

### T063-030: External API Integration
**Objective**: Verify external service integrations

**Steps**:
1. Test SEC EDGAR API calls
2. Verify stock price updates
3. Test Stripe payment processing (sandbox)
4. Check third-party authentication

**Expected Results**:
- SEC data retrieved accurately
- Stock prices update correctly
- Payment processing works (sandbox)
- External auth providers work

## Final Smoke Test

### T063-031: Complete User Journey
**Objective**: End-to-end user experience test

**Steps**:
1. Register new account
2. Verify email
3. Complete profile setup
4. Add companies to watchlist
5. Configure alert preferences
6. Review generated alerts
7. Upgrade subscription (test mode)
8. Access premium features
9. Generate usage reports

**Expected Results**:
- Complete user journey works smoothly
- No blocking errors encountered
- All features accessible as expected
- Professional user experience maintained

## Reporting Test Results

For each test scenario, document:

### Test Execution Record
- **Test ID**: T063-XXX
- **Test Name**: Scenario name
- **Date Executed**: Date/time
- **Tester**: Your name
- **Environment**: Development/Staging/Production
- **Browser/Device**: Testing platform
- **Status**: Pass/Fail/Blocked
- **Notes**: Any observations or issues
- **Screenshots**: Attach if issues found

### Issue Reporting Template
If issues are found:

```
**Bug Report: [Brief Description]**

**Test Scenario**: T063-XXX
**Environment**: [Development/Staging/Production]
**Browser/Device**: [Chrome 91, iPhone 12, etc.]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Severity**: Critical/High/Medium/Low
**Priority**: P1/P2/P3/P4

**Screenshots/Videos**: [Attach if available]
```

## Test Completion Criteria

Testing is considered complete when:
- [ ] All test scenarios executed
- [ ] All critical/high priority issues resolved
- [ ] Performance benchmarks met
- [ ] Security requirements validated
- [ ] Mobile responsiveness confirmed
- [ ] Cross-browser compatibility verified
- [ ] Integration points tested
- [ ] User experience flows validated

## Notes for Testers

1. **Test Data**: Use only designated test accounts and data
2. **Environment**: Confirm you're testing in the correct environment
3. **Documentation**: Record all findings, even minor issues
4. **Communication**: Report blocking issues immediately
5. **Cleanup**: Reset test data state when needed
6. **Security**: Never test with real payment information
7. **Performance**: Note any performance issues, even minor ones

This manual testing guide ensures comprehensive coverage of the WhatChanged application functionality and provides a systematic approach to quality assurance.