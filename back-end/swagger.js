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
        summary: "Create employee",
        description: "Requires permission: EMP_CREATE",
        security: [{ BearerAuth: [] }],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateEmployee"
              }
            }
          }
        },

        responses: {
          201: { description: "Employee created successfully" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" },
          403: { description: "Permission denied" },
          409: { description: "Duplicate employee code" }
        }
      },

      get: {
        tags: ["Employees"],
        summary: "List employees",
        description: "Requires permission: EMP_VIEW",
        security: [{ BearerAuth: [] }],

        parameters: [
          { name: "page", in: "query", schema: { type: "integer", example: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", example: 10 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "departmentId", in: "query", schema: { type: "string" } },
          { name: "designationId", in: "query", schema: { type: "string" } },
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
          200: { description: "Employees fetched successfully" },
          401: { description: "Unauthorized" },
          403: { description: "Permission denied" }
        }
      },
    },

    "/employees/{id}": {
      get: {
        tags: ["Employees"],
        summary: "Get employee by ID",
        description: "Requires permission: EMP_VIEW",
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
          200: { description: "Employee fetched successfully" },
          401: { description: "Unauthorized" },
          403: { description: "Permission denied" },
          404: { description: "Employee not found" }
        }
      },

      put: {
        tags: ["Employees"],
        summary: "Update employee",
        description: "Requires permission: EMP_UPDATE",
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
                $ref: "#/components/schemas/UpdateEmployee"
              }
            }
          }
        },

        responses: {
          200: { description: "Employee updated successfully" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" },
          403: { description: "Permission denied" },
          404: { description: "Employee not found" }
        }
      },

      delete: {
        tags: ["Employees"],
        summary: "Delete employee (soft delete)",
        description: "Requires permission: EMP_DELETE",
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
          200: { description: "Employee deleted successfully" },
          401: { description: "Unauthorized" },
          403: { description: "Permission denied" },
          404: { description: "Employee not found" }
        }
      }
    },

    "/api/employees/me": {
      get: {
        tags: ["Employees"],
        summary: "Get logged-in employee profile",
        description: "Requires permission: EMP_SELF_VIEW",
        security: [{ BearerAuth: [] }],

        responses: {
          200: { description: "Employee profile fetched successfully" },
          401: { description: "Unauthorized" },
          403: { description: "Permission denied" }
        }
      }
    },

    "/api/employees/{id}/restore": {
      patch: {
        tags: ["Employees"],
        summary: "Restore deleted employee",
        description: "Requires permission: EMP_RESTORE",
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
          200: { description: "Employee restored successfully" },
          401: { description: "Unauthorized" },
          403: { description: "Permission denied" },
          404: { description: "Employee not found" }
        }
      }
    }
  }
};
