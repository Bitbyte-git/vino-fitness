/**
 * OpenAPI 3.0.0 Specification for Vino Fitness Studio (PulseFit) Gym Management API
 */

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Vino Fitness Studio API',
    version: '1.0.0',
    description: 'Comprehensive REST API documentation for Vino Fitness Studio Gym Management System. Covering authentication, members, trainers, memberships, payments, attendance, biometric verification, time slots, reports, and system settings.',
    contact: {
      name: 'Vino Fitness Studio Engineering',
      email: 'admin@pulsefit.com',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Current API Server',
    },
    {
      url: 'https://vinofitnessstudio.vercel.app/api',
      description: 'Production Cloud Server',
    },
    {
      url: 'http://localhost:5000/api',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT bearer token in the format: Bearer <token>',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Error message description' },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '60d0fe4f5311236168a109ca' },
          name: { type: 'string', example: 'Admin User' },
          email: { type: 'string', format: 'email', example: 'admin@pulsefit.com' },
          role: { type: 'string', enum: ['admin', 'trainer', 'member', 'reception'], example: 'admin' },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      MemberProfile: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '60d0fe4f5311236168a109cb' },
          memberId: { type: 'string', example: 'GYM0001' },
          fullName: { type: 'string', example: 'John Doe' },
          dateOfBirth: { type: 'string', format: 'date', example: '1995-06-15' },
          gender: { type: 'string', enum: ['male', 'female', 'other'], example: 'male' },
          mobileNumber: { type: 'string', example: '9876543210' },
          address: { type: 'string', example: '123 Cross St, Chennai' },
          emergencyContact: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Jane Doe' },
              relationship: { type: 'string', example: 'Spouse' },
              mobileNumber: { type: 'string', example: '9876543211' },
            },
          },
          height: { type: 'number', example: 178 },
          weight: { type: 'number', example: 75 },
          fitnessGoal: { type: 'string', example: 'weight_loss' },
          exerciseExperience: { type: 'string', example: 'intermediate' },
          registrationStatus: { type: 'string', enum: ['active', 'pending', 'expired', 'frozen'], example: 'active' },
          biometricEnrolled: { type: 'boolean', example: true },
        },
      },
      TrainerProfile: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '60d0fe4f5311236168a109cc' },
          trainerId: { type: 'string', example: 'TR0001' },
          fullName: { type: 'string', example: 'Vikram Singh' },
          gender: { type: 'string', example: 'male' },
          specialization: { type: 'string', example: 'Olympic Weightlifting' },
          experience: { type: 'number', example: 7 },
          convenientTimings: {
            type: 'array',
            items: { type: 'string', enum: ['Morning', 'Afternoon', 'Evening'] },
            example: ['Morning', 'Evening'],
          },
          status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
        },
      },
      MembershipPlan: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '60d0fe4f5311236168a109cd' },
          planName: { type: 'string', example: 'Elite Annual Pro' },
          description: { type: 'string', example: 'Full gym and cardio access for 12 months' },
          durationMonths: { type: 'number', example: 12 },
          price: { type: 'number', example: 14999 },
          facilities: { type: 'array', items: { type: 'string' }, example: ['Gym', 'Cardio', 'Locker', 'Steam'] },
          isActive: { type: 'boolean', example: true },
        },
      },
      Payment: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '60d0fe4f5311236168a109ce' },
          transactionId: { type: 'string', example: 'TXN1795763920123' },
          member: { type: 'string', example: '60d0fe4f5311236168a109cb' },
          amount: { type: 'number', example: 4999 },
          paymentMethod: { type: 'string', enum: ['cash', 'card', 'upi', 'online'], example: 'upi' },
          paymentStatus: { type: 'string', enum: ['completed', 'pending', 'failed', 'refunded'], example: 'completed' },
          paymentDate: { type: 'string', format: 'date-time' },
        },
      },
      AttendanceRecord: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '60d0fe4f5311236168a109cf' },
          member: { type: 'string', example: '60d0fe4f5311236168a109cb' },
          checkInTime: { type: 'string', format: 'date-time' },
          checkOutTime: { type: 'string', format: 'date-time' },
          duration: { type: 'number', description: 'Duration in minutes', example: 75 },
          sessionType: { type: 'string', enum: ['Morning', 'Afternoon', 'Evening'], example: 'Morning' },
          status: { type: 'string', enum: ['checked-in', 'checked-out', 'auto-checked-out'], example: 'checked-in' },
        },
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'System health and readiness check',
        description: 'Returns the health status of the application and its database connection for Kubernetes liveness/readiness probes.',
        tags: ['System'],
        security: [],
        responses: {
          200: {
            description: 'Application is healthy and database is connected.',
          },
          503: {
            description: 'Application is down or database is unavailable.',
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'User Login',
        description: 'Authenticates a user by email and password, returning JWT access token and user role profile.',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@pulsefit.com' },
                  password: { type: 'string', format: 'password', example: 'Admin@123456' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Successfully authenticated.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
                    refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          401: {
            description: 'Invalid credentials or inactive account.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'User Registration',
        description: 'Creates a new user credentials account.',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'role'],
                properties: {
                  name: { type: 'string', example: 'New User' },
                  email: { type: 'string', format: 'email', example: 'member@test.com' },
                  password: { type: 'string', format: 'password', example: 'Secret123!' },
                  role: { type: 'string', enum: ['member', 'trainer', 'reception'], example: 'member' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'User registered successfully.',
          },
          400: {
            description: 'Email already exists or validation error.',
          },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get Current Authenticated User',
        description: 'Returns profile of current user decoded from JWT Bearer token.',
        tags: ['Authentication'],
        responses: {
          200: {
            description: 'User profile retrieved.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized or token expired.' },
        },
      },
    },
    '/auth/refresh-token': {
      post: {
        summary: 'Refresh Access Token',
        description: 'Issues a new short-lived access token using a valid refresh token.',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'New tokens issued.',
          },
          401: { description: 'Invalid or expired refresh token.' },
        },
      },
    },
    '/members': {
      get: {
        summary: 'List Members',
        description: 'Returns list of members with search, filter, and pagination support. (Admin / Reception only)',
        tags: ['Members'],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by name, email, or memberId' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'pending', 'expired', 'frozen'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: {
            description: 'Members retrieved successfully.',
          },
          403: { description: 'Access forbidden.' },
        },
      },
      post: {
        summary: 'Create Member',
        description: 'Creates a new member profile. (Admin / Reception only)',
        tags: ['Members'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MemberProfile' },
            },
          },
        },
        responses: {
          201: { description: 'Member profile created.' },
          400: { description: 'Validation failed.' },
        },
      },
    },
    '/members/{id}': {
      get: {
        summary: 'Get Member By ID',
        description: 'Retrieves member profile details.',
        tags: ['Members'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Member found.' },
          404: { description: 'Member not found.' },
        },
      },
      put: {
        summary: 'Update Member Profile',
        description: 'Updates member profile fields.',
        tags: ['Members'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/MemberProfile' } },
          },
        },
        responses: {
          200: { description: 'Member updated successfully.' },
        },
      },
      delete: {
        summary: 'Delete Member',
        description: 'Removes or deactivates member record. (Admin only)',
        tags: ['Members'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Member deleted.' },
        },
      },
    },
    '/trainers': {
      get: {
        summary: 'List Trainers',
        description: 'Returns active fitness coaches and their specialties.',
        tags: ['Trainers'],
        responses: {
          200: { description: 'List of trainers.' },
        },
      },
      post: {
        summary: 'Add Trainer',
        description: 'Registers a new trainer profile. (Admin only)',
        tags: ['Trainers'],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/TrainerProfile' } },
          },
        },
        responses: {
          201: { description: 'Trainer created.' },
        },
      },
    },
    '/membership-plans': {
      get: {
        summary: 'Get All Membership Plans',
        description: 'Returns available membership tiers, pricing, and benefits.',
        tags: ['Membership Plans'],
        security: [],
        responses: {
          200: { description: 'List of plans.' },
        },
      },
      post: {
        summary: 'Create Membership Plan',
        description: 'Creates a new gym plan. (Admin only)',
        tags: ['Membership Plans'],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/MembershipPlan' } },
          },
        },
        responses: {
          201: { description: 'Plan created.' },
        },
      },
    },
    '/memberships': {
      get: {
        summary: 'List Active Memberships',
        description: 'Lists all member memberships and their validity dates.',
        tags: ['Memberships'],
        responses: {
          200: { description: 'Memberships list.' },
        },
      },
      post: {
        summary: 'Assign / Activate Membership',
        description: 'Assigns a membership plan to a member.',
        tags: ['Memberships'],
        responses: {
          201: { description: 'Membership assigned.' },
        },
      },
    },
    '/memberships/{id}/renew': {
      post: {
        summary: 'Renew Membership',
        description: 'Extends membership end date from the current expiry date.',
        tags: ['Memberships'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Membership renewed.' },
        },
      },
    },
    '/payments': {
      get: {
        summary: 'List Payments',
        description: 'Returns payment transaction records and receipts.',
        tags: ['Payments'],
        responses: {
          200: { description: 'Payments list.' },
        },
      },
      post: {
        summary: 'Record Payment',
        description: 'Records a cash, UPI, or card payment against a membership invoice.',
        tags: ['Payments'],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Payment' } },
          },
        },
        responses: {
          201: { description: 'Payment recorded.' },
        },
      },
    },
    '/payments/pending-dues': {
      get: {
        summary: 'Pending Dues Report',
        description: 'Lists all members with overdue or pending membership balances.',
        tags: ['Payments'],
        responses: {
          200: { description: 'Pending dues list.' },
        },
      },
    },
    '/attendance': {
      get: {
        summary: 'List Attendance Records',
        description: 'Returns gym check-ins and check-outs filtered by date or member.',
        tags: ['Attendance'],
        responses: {
          200: { description: 'Attendance logs.' },
        },
      },
    },
    '/attendance/check-in': {
      post: {
        summary: 'Manual Member Check-In',
        description: 'Registers member arrival at the gym for the current session.',
        tags: ['Attendance'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['memberId'],
                properties: {
                  memberId: { type: 'string', example: '60d0fe4f5311236168a109cb' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Check-in recorded.' },
          400: { description: 'Already checked in for this session or inactive membership.' },
        },
      },
    },
    '/attendance/check-out': {
      post: {
        summary: 'Manual Member Check-Out',
        description: 'Records departure time and calculates workout duration.',
        tags: ['Attendance'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['memberId'],
                properties: {
                  memberId: { type: 'string', example: '60d0fe4f5311236168a109cb' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Check-out recorded.' },
        },
      },
    },
    '/attendance/biometric/scan': {
      post: {
        summary: 'Biometric Kiosk Verification Scan',
        description: 'Handles fingerprint verification from Mantra MFS110 L1 scanner at the kiosk terminal.',
        tags: ['Attendance', 'Biometrics'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  template: { type: 'string', description: 'ISO/ANSI fingerprint template Base64' },
                  deviceSerial: { type: 'string', example: 'MFS110-123456' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Attendance recorded successfully via biometric verification.' },
          409: { description: 'Attendance already recorded for this session.' },
        },
      },
    },
    '/biometrics/status': {
      get: {
        summary: 'Get RD Service Status',
        description: 'Checks connectivity to Mantra RD Service driver.',
        tags: ['Biometrics'],
        responses: {
          200: { description: 'RD Service status returned.' },
        },
      },
    },
    '/biometrics/enroll/process': {
      post: {
        summary: 'Process Biometric Fingerprint Enrollment',
        description: 'Enrolls member fingerprint reference in database securely.',
        tags: ['Biometrics'],
        responses: {
          200: { description: 'Fingerprint enrolled.' },
        },
      },
    },
    '/time-slots': {
      get: {
        summary: 'List Gym Time Slots',
        description: 'Returns configured daily morning, afternoon, and evening slots with max capacity.',
        tags: ['Time Slots'],
        responses: {
          200: { description: 'Slots list.' },
        },
      },
    },
    '/dashboard/{role}': {
      get: {
        summary: 'Role-Specific Dashboard Analytics',
        description: 'Returns KPI counts, trends, and charts for admin, trainer, or member dashboard.',
        tags: ['Dashboard'],
        parameters: [
          { name: 'role', in: 'path', required: true, schema: { type: 'string', enum: ['admin', 'trainer', 'member'] } },
        ],
        responses: {
          200: { description: 'Dashboard stats payload.' },
        },
      },
    },
    '/reports/revenue': {
      get: {
        summary: 'Revenue & Financial Analytics',
        description: 'Monthly collection breakdown, payment methods, and revenue totals. (Admin only)',
        tags: ['Reports'],
        responses: {
          200: { description: 'Revenue report.' },
        },
      },
    },
    '/settings': {
      get: {
        summary: 'System Settings',
        description: 'Returns gym system settings (biometrics, attendance grace periods, notifications).',
        tags: ['Settings'],
        responses: {
          200: { description: 'System settings.' },
        },
      },
    },
  },
};

module.exports = swaggerDocument;
