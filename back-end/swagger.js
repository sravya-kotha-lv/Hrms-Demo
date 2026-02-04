module.exports = {
  openapi: "3.0.0",
  info: {
    title: "Upanaya HRMS API",
    description: "Multi-Org HRMS Backend APIs",
    version: "1.0.0"
  },

  servers: [
    {
      url: "http://localhost:8000/api",
      description: "Local server"
    }
  ],

  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },

    schemas: {
      /* ===================== AUTH ===================== */
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            example: "superadmin@luvetha.com"
          },
          password: {
            type: "string",
            example: "SuperAdmin@123"
          }
        }
      },

      LoginResponse: {
        type: "object",
        properties: {
          token: { type: "string" },
          organization: { type: "object" },
          roles: {
            type: "array",
            items: { type: "object" }
          }
        }
      },

      /* ===================== ORGANIZATION ===================== */
      Organization: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          code: { type: "string" },
          timezone: { type: "string" },
          currency: { type: "string" },
          status: {
            type: "string",
            enum: ["active", "inactive"]
          },
          createdAt: { type: "string" },
          updatedAt: { type: "string" }
        }
      },

      CreateOrganizationRequest: {
        type: "object",
        required: [
          "name",
          "code",
          "timezone",
          "currency",
          "adminUserId",
          "adminRoleId"
        ],
        properties: {
          name: { type: "string" },
          code: { type: "string" },
          timezone: { type: "string" },
          currency: { type: "string" },
          adminUserId: { type: "string" },
          adminRoleId: { type: "string" }
        }
      },

      SwitchOrgRequest: {
        type: "object",
        required: ["organizationId"],
        properties: {
          organizationId: {
            type: "string",
            description: "Target organization ID"
          },
          // roleId: {
          //   type: "string",
          //   description: "Optional role ID inside the organization"
          // }
        }
      },

      SwitchOrgResponse: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "New JWT token after switching context"
          },
          organizationId: {
            type: "string"
          },
          activeRoleId: {
            type: "string"
          },
          roles: {
            type: "array",
            items: {
              type: "object"
            }
          }
        }
      },

      /* ===================== USERS ===================== */
      CreateUserRequest: {
        type: "object",
        required: ["email", "password", "roleIds"],
        properties: {
          email: {
            type: "string",
            example: "employee@luvetha.com"
          },
          password: {
            type: "string",
            example: "Employee@123"
          },
          roleIds: {
            type: "array",
            items: { type: "string" }
          }
        }
      },

      CreateEmployeeByHr: {
        type: "object",
        required: [
          "email",
          "roleIds",
          "firstName",
          "lastName",
          "employeeCode",
          "departmentId",
          "designationId",
          "dateOfJoining",
          "employmentType"
        ],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "john.doe@company.com"
          },
          roleIds: {
            type: "array",
            items: {
              type: "string",
              example: "65b1f1c4b92c1a00123abcd1"
            }
          },
          firstName: {
            type: "string",
            example: "John"
          },
          lastName: {
            type: "string",
            example: "Doe"
          },
          employeeCode: {
            type: "string",
            example: "EMP-001"
          },
          departmentId: {
            type: "string",
            example: "65b1f1c4b92c1a00123abcd2"
          },
          designationId: {
            type: "string",
            example: "65b1f1c4b92c1a00123abcd3"
          },
          dateOfJoining: {
            type: "string",
            format: "date",
            example: "2026-02-01"
          },
          employmentType: {
            type: "string",
            enum: ["full_time", "part_time", "contract"],
            example: "full_time"
          }
        }
      },

      CompleteEmployeeProfile: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            example: "+91-9876543210"
          },
          dob: {
            type: "string",
            format: "date",
            example: "1995-08-15"
          },
          gender: {
            type: "string",
            example: "male"
          },
          address: {
            type: "object",
            properties: {
              line1: { type: "string", example: "Street 1" },
              line2: { type: "string", example: "Area" },
              city: { type: "string", example: "Bangalore" },
              state: { type: "string", example: "KA" },
              country: { type: "string", example: "India" },
              zip: { type: "string", example: "560001" }
            }
          },
          emergencyContacts: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "relation", "phone"],
              properties: {
                name: { type: "string", example: "Jane Doe" },
                relation: { type: "string", example: "Spouse" },
                phone: { type: "string", example: "+91-9876543211" }
              }
            }
          }
        }
      },

      LeaveType: {
        type: "object",
        required: ["name", "code", "daysPerYear", "organizationId"],
        properties: {
          name: { type: "string", example: "Annual Leave" },
          code: { type: "string", example: "AL" },
          daysPerYear: { type: "number", example: 15 },
          isCarryForward: { type: "boolean", example: false },
          status: { type: "string", enum: ["active", "inactive"], default: "active" },
        },
      },
      
      Holiday: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string", example: "New Year's Day" },
          date: { type: "string", format: "date", example: "2026-01-01" },
          year: { type: "number", example: 2026 },
          status: { type: "string", enum: ["active", "inactive"] },
          createdAt: { type: "string" },
          updatedAt: { type: "string" }
        }
      },

      CreateHolidayRequest: {
        type: "object",
        required: ["name", "date"],
        properties: {
          name: { type: "string", example: "Republic Day" },
          date: { type: "string", format: "date", example: "2026-01-26" },
          status: { type: "string", enum: ["active", "inactive"], default: "active" }
        }
      },

      UpdateHolidayRequest: {
        type: "object",
        properties: {
          name: { type: "string", example: "Republic Day" },
          date: { type: "string", format: "date", example: "2026-01-26" },
          status: { type: "string", enum: ["active", "inactive"] }
        }
      },

      WeekOff: {
        type: "object",
        properties: {
          _id: { type: "string" },
          weekOffDays: {
            type: "array",
            items: { type: "number", minimum: 0, maximum: 6 },
            example: [0, 6]
          }
        }
      },

      WeekOffUpsertRequest: {
        type: "object",
        required: ["weekOffDays"],
        properties: {
          weekOffDays: {
            type: "array",
            items: { type: "number", minimum: 0, maximum: 6 },
            example: [0, 6]
          }
        }
      },

      LeaveBalance: {
        type: "object",
        properties: {
          leaveTypeId: { type: "string" },
          leaveType: { type: "string", example: "Annual Leave" },
          code: { type: "string", example: "AL" },
          total: { type: "number", example: 15 },
          used: { type: "number", example: 4 },
          remaining: { type: "number", example: 11 }
        }
      },

      ApiSuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: { type: "object", nullable: true }
        }
      },

      ApiErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          code: { type: "number", example: 400 },
          message: { type: "string" },
          data: { nullable: true },
          error: { nullable: true }
        }
      },

      Employee: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "65a9f2d1e3b4c1a9f2d1e3b4"
          },
          firstName: {
            type: "string",
            example: "John"
          },
          lastName: {
            type: "string",
            example: "Doe"
          },
          employeeCode: {
            type: "string",
            example: "EMP001"
          },
          phone: {
            type: "string",
            example: "+91-9876543210"
          },
          departmentId: {
            type: "object",
            properties: {
              _id: { type: "string" },
              name: { type: "string", example: "Engineering" }
            }
          },
          designationId: {
            type: "object",
            properties: {
              _id: { type: "string" },
              name: { type: "string", example: "Software Engineer" }
            }
          },
          status: {
            type: "string",
            enum: ["active", "on_leave", "resigned"],
            example: "active"
          },
          dateOfJoining: {
            type: "string",
            format: "date",
            example: "2024-01-15"
          },
          employmentType: {
            type: "string",
            enum: ["full_time", "part_time", "contract"],
            example: "full_time"
          }
        }
      }
    }
  },

  paths: {
    /* ===================== AUTH ===================== */

    "/users/login": {
      post: {
        tags: ["Auth"],
        summary: "Login user (SuperAdmin / Org Admin / Employee)",
        description: "Authenticate user and return JWT token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LoginRequest"
              }
            }
          }
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/LoginResponse"
                }
              }
            }
          },
          400: {
            description: "Invalid credentials"
          }
        }
      }
    },

    "/users/switch-org": {
      post: {
        tags: ["Users"],
        summary: "Switch active organization / role",
        description: "Switch user context to another organization and optionally a role",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SwitchOrgRequest"
              }
            }
          }
        },
        responses: {
          200: {
            description: "Organization / role switched successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    code: { type: "number", example: 200 },
                    message: { type: "string", example: "Context switched successfully" },
                    data: {
                      $ref: "#/components/schemas/SwitchOrgResponse"
                    },
                    error: { type: "null" }
                  }
                }
              }
            }
          },
          403: {
            description: "User does not belong to organization / role"
          }
        }
      }
    },

    "/users/send-otp": {
      post: {
        tags: ["Users"],
        summary: "Send OTP to email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", example: "admin@company.com" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "OTP sent successfully" },
          404: { description: "Email not registered" }
        }
      }
    },
    "/users/verify-otp": {
      post: {
        tags: ["Users"],
        summary: "Verify OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "otp"],
                properties: {
                  email: { type: "string", example: "admin@company.com" },
                  otp: { type: "string", example: "123456" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "OTP verified successfully" },
          400: { description: "Invalid or expired OTP" }
        }
      }
    },
    /* ===================== ORGANIZATIONS ===================== */


    "/organizations": {
      post: {
        tags: ["Organization"],
        summary: "Create organization and assign admin",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateOrganizationRequest"
              }
            }
          }
        },
        responses: {
          201: {
            description: "Organization created successfully"
          }
        }
      },

      get: {
        tags: ["Organization"],
        summary: "Get all organizations",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "List of organizations",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/Organization"
                  }
                }
              }
            }
          }
        }
      }
    },

    "/organizations/{id}": {
      get: {
        tags: ["Organization"],
        summary: "Get organization by ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: {
            description: "Organization details"
          }
        }
      },

      put: {
        tags: ["Organization"],
        summary: "Update organization",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  timezone: { type: "string" },
                  currency: { type: "string" },
                  status: {
                    type: "string",
                    enum: ["active", "inactive"]
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Organization updated successfully"
          }
        }
      },

      delete: {
        tags: ["Organization"],
        summary: "Deactivate organization",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: {
            description: "Organization deactivated successfully"
          }
        }
      }
    },

    /* ===================== USERS ===================== */

    "/users/org-user": {
      post: {
        tags: ["Users"],
        summary: "Org Admin / HR creates user",
        description: "Employees cannot self-register",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateUserRequest"
              }
            }
          }
        },
        responses: {
          201: {
            description: "User created successfully"
          }
        }
      }
    },

    "/roles": {
      get: {
        tags: ["Roles"],
        summary: "List roles",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "Roles fetched" } }
      },

      post: {
        tags: ["Roles"],
        summary: "Create role",
        description: "Create a new role with permissions",
        security: [{ BearerAuth: [] }],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "slug", "permissionIds"],
                properties: {
                  name: {
                    type: "string",
                    example: "HR Manager"
                  },
                  slug: {
                    type: "string",
                    example: "hr_manager"
                  },
                  permissionIds: {
                    type: "array",
                    items: {
                      type: "string",
                      example: "64f1c9e8f9b1a23c8a9d1234"
                    }
                  },
                  isSystemRole: {
                    type: "boolean",
                    example: false
                  }
                }
              }
            }
          }
        },

        responses: {
          201: {
            description: "Role created successfully"
          },
          400: {
            description: "Validation error"
          },
          403: {
            description: "Permission denied"
          },
          409: {
            description: "Role already exists"
          }
        }
      }

    },

    "/roles/{id}": {
      put: {
        tags: ["Roles"],
        summary: "Update role",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Updated Role" },
                  permissionIds: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Role updated successfully" },
          404: { description: "Role not found" }
        }
      },

      delete: {
        tags: ["Roles"],
        summary: "Delete role",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true }],
        responses: { 200: { description: "Role deleted" } }
      }
    },

    "/roles/switch": {
      post: {
        tags: ["Roles"],
        summary: "Switch active role",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["roleId"],
                properties: {
                  roleId: { type: "string" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Role switched" } }
      }
    },

    "/departments": {
      post: {
        tags: ["Departments"],
        summary: "Create department",
        description: "Create a new department in the organization",
        security: [{ BearerAuth: [] }],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "code"],
                properties: {
                  name: {
                    type: "string",
                    minLength: 2,
                    example: "Human Resources"
                  },
                  code: {
                    type: "string",
                    minLength: 2,
                    example: "HR"
                  },
                  // managerId: {
                  //   type: "string",
                  //   nullable: true,
                  //   example: "64f1c9e8f9b1a23c8a9d1234"
                  // }
                }
              }
            }
          }
        },

        responses: {
          201: {
            description: "Department created successfully"
          },
          400: {
            description: "Validation error"
          },
          403: {
            description: "Permission denied"
          },
          409: {
            description: "Department with same code already exists"
          }
        }
      },
      get: {
        tags: ["Departments"],
        summary: "List departments",
        description: "Fetch all active departments for the organization",
        security: [{ BearerAuth: [] }],

        responses: {
          200: {
            description: "Departments fetched successfully",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      _id: {
                        type: "string",
                        example: "64f1c9e8f9b1a23c8a9d1234"
                      },
                      name: {
                        type: "string",
                        example: "Human Resources"
                      },
                      code: {
                        type: "string",
                        example: "HR"
                      },
                      managerId: {
                        type: "string",
                        nullable: true,
                        example: "64f1c9e8f9b1a23c8a9d5678"
                      },
                      status: {
                        type: "string",
                        enum: ["active", "inactive"],
                        example: "active"
                      },
                      createdAt: {
                        type: "string",
                        format: "date-time"
                      },
                      updatedAt: {
                        type: "string",
                        format: "date-time"
                      }
                    }
                  }
                }
              }
            }
          },

          401: {
            description: "Unauthorized"
          },
          403: {
            description: "Permission denied"
          }
        }
      }
    },

    "/departments/{id}": {
      put: {
        tags: ["Departments"],
        summary: "Update department",
        description: "Update an existing department",
        security: [{ BearerAuth: [] }],

        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string"
            }
          }
        ],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    minLength: 2,
                    example: "Updated HR"
                  },
                  code: {
                    type: "string",
                    minLength: 2,
                    example: "HR_NEW"
                  },
                  // managerId: {
                  //   type: "string",
                  //   nullable: true,
                  //   example: "64f1c9e8f9b1a23c8a9d1234"
                  // },
                  status: {
                    type: "string",
                    enum: ["active", "inactive"],
                    example: "active"
                  }
                }
              }
            }
          }
        },

        responses: {
          200: {
            description: "Department updated successfully"
          },
          400: {
            description: "Validation error"
          },
          403: {
            description: "Permission denied"
          },
          404: {
            description: "Department not found"
          }
        }
      },
      delete: {
        tags: ["Departments"],
        summary: "Delete department",
        description: "Soft delete a department",
        security: [{ BearerAuth: [] }],

        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string"
            },
            description: "Department ID"
          }
        ],

        responses: {
          200: {
            description: "Department deleted successfully"
          },
          401: {
            description: "Unauthorized"
          },
          403: {
            description: "Permission denied"
          },
          404: {
            description: "Department not found"
          }
        }
      }
    },

    "/designations": {
      post: {
        tags: ["Designations"],
        summary: "Create designation",
        description: "Create a new designation for the organization",
        security: [{ BearerAuth: [] }],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: {
                    type: "string",
                    minLength: 2,
                    example: "Senior Software Engineer"
                  },
                  level: {
                    type: "number",
                    example: 3,
                    description: "Optional hierarchy level"
                  }
                }
              }
            }
          }
        },

        responses: {
          201: {
            description: "Designation created successfully"
          },
          400: {
            description: "Validation error"
          },
          403: {
            description: "Permission denied"
          },
          409: {
            description: "Designation already exists"
          }
        }
      },
      get: {
        tags: ["Designations"],
        summary: "List designations",
        description: "Fetch all active designations",
        security: [{ BearerAuth: [] }],

        responses: {
          200: {
            description: "Designations fetched successfully",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      _id: { type: "string" },
                      name: { type: "string" },
                      level: { type: "number" },
                      status: {
                        type: "string",
                        enum: ["active", "inactive"]
                      },
                      createdAt: {
                        type: "string",
                        format: "date-time"
                      }
                    }
                  }
                }
              }
            }
          },
          401: { description: "Unauthorized" },
          403: { description: "Permission denied" }
        }
      }
    },

    "/designations/{id}": {
      put: {
        tags: ["Designations"],
        summary: "Update designation",
        description: "Update an existing designation",
        security: [{ BearerAuth: [] }],

        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string"
            },
            description: "Designation ID"
          }
        ],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    minLength: 2,
                    example: "Lead Software Engineer"
                  },
                  level: {
                    type: "number",
                    example: 4
                  },
                  status: {
                    type: "string",
                    enum: ["active", "inactive"],
                    example: "active"
                  }
                }
              }
            }
          }
        },

        responses: {
          200: {
            description: "Designation updated successfully"
          },
          400: {
            description: "Validation error"
          },
          403: {
            description: "Permission denied"
          },
          404: {
            description: "Designation not found"
          }
        }
      },
      delete: {
        tags: ["Designations"],
        summary: "Delete designation",
        description: "Soft delete a designation",
        security: [{ BearerAuth: [] }],

        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],

        responses: {
          200: {
            description: "Designation deleted successfully"
          },
          401: { description: "Unauthorized" },
          403: { description: "Permission denied" },
          404: { description: "Designation not found" }
        }
      }
    },

    "/employees": {
      post: {
        tags: ["Employees"],
        summary: "HR/Admin creates employee",
        description:
          "Creates User + Employee and sends onboarding email. Requires permission: EMP_CREATE",
        security: [{ BearerAuth: [] }],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateEmployeeByHr"
              }
            }
          }
        },

        responses: {
          201: {
            description: "Employee created & onboarding email sent",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiSuccessResponse" }
              }
            }
          },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" },
          403: { description: "Permission denied" },
          409: { description: "User already exists" }
        }
      },
      get: {
        tags: ["Employees"],
        summary: "List employees (organization-wise)",
        description: "Fetch employees belonging to the logged-in user's organization. Requires permission: EMP_VIEW",
        security: [{ BearerAuth: [] }],

        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", example: 1 }
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", example: 10 }
          },
          {
            name: "search",
            in: "query",
            schema: {
              type: "string",
              example: "john"
            },
            description: "Search by first name, last name, employee code, or phone"
          },
          {
            name: "departmentId",
            in: "query",
            schema: {
              type: "string",
              example: "65a9f2d1e3b4c1a9f2d1e3b4"
            }
          },
          {
            name: "designationId",
            in: "query",
            schema: {
              type: "string",
              example: "65a9f2d1e3b4c1a9f2d1e3b5"
            }
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["active", "on_leave", "resigned"]
            }
          }
        ],

        responses: {
          200: {
            description: "Employees fetched successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: { type: "string", example: "Employees fetched successfully" },
                    data: {
                      type: "object",
                      properties: {
                        items: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Employee" }
                        },
                        pagination: {
                          type: "object",
                          properties: {
                            total: { type: "integer", example: 25 },
                            page: { type: "integer", example: 1 },
                            limit: { type: "integer", example: 10 },
                            totalPages: { type: "integer", example: 3 }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          401: { description: "Unauthorized" },
          403: { description: "Permission denied" }
        }
      }
    },

    "/employees/me/profile": {
      put: {
        tags: ["Employees"],
        summary: "Employee completes own profile",
        description:
          "Employee fills remaining profile details on first login. Requires permission: EMP_SELF_EDIT",
        security: [{ BearerAuth: [] }],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CompleteEmployeeProfile"
              }
            }
          }
        },

        responses: {
          200: {
            description: "Profile completed successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiSuccessResponse" }
              }
            }
          },
          401: { description: "Unauthorized" },
          404: { description: "Employee record not found" }
        }
      }
    },

    "/employees/leave-types": {
      get: {
        tags: ["Employees"],
        summary: "List all employee leave types",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Success" },
        },
      },
    },
    
    "/leave-types": {
      post: {
        tags: ["LeaveTypes"],
        summary: "Create a new leave type",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LeaveType" },
            },
          },
        },
        responses: {
          201: { description: "Created successfully" },
        },
      },
      get: {
        tags: ["LeaveTypes"],
        summary: "List all leave types",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Success" },
        },
      },
    },
    "/leave-types/{id}": {
      put: {
        tags: ["LeaveTypes"],
        summary: "Update/Enable/Disable Leave Type",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  status: { type: "string", enum: ["active", "inactive"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated" },
        },
      },
      delete: {
        tags: ["LeaveTypes"],
        summary: "Soft delete (Deactivate)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Deactivated" },
        },
      },
    },

    "/holidays": {
      post: {
        tags: ["Holidays"],
        summary: "Create a holiday",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateHolidayRequest" },
            },
          },
        },
        responses: {
          201: { description: "Holiday created" },
        },
      },
      get: {
        tags: ["Holidays"],
        summary: "List holidays",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "year",
            in: "query",
            required: false,
            schema: { type: "number", example: 2026 },
          },
        ],
        responses: {
          200: { description: "Success" },
        },
      },
    },

    "/holidays/{id}": {
      put: {
        tags: ["Holidays"],
        summary: "Update a holiday",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateHolidayRequest" },
            },
          },
        },
        responses: {
          200: { description: "Holiday updated" },
        },
      },
      delete: {
        tags: ["Holidays"],
        summary: "Delete a holiday",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Holiday deleted" },
        },
      },
    },

    "/week-offs": {
      post: {
        tags: ["WeekOffs"],
        summary: "Create or update week off configuration",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WeekOffUpsertRequest" },
            },
          },
        },
        responses: {
          200: { description: "Week off configuration saved" },
        },
      },
      get: {
        tags: ["WeekOffs"],
        summary: "Get week off configuration",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Success" },
        },
      },
    },

    "/leave-balances/my": {
      get: {
        tags: ["LeaveBalances"],
        summary: "Get my leave balance",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Success" },
        },
      },
    },

    "/leave-balances/employee/{employeeId}": {
      get: {
        tags: ["LeaveBalances"],
        summary: "Get employee leave balance",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "employeeId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Success" },
        },
      },
    },
  }
};
