import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  sanitizeCodeInput,
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizePhoneInput,
  sanitizeSlugInput
} from "@/utils/validators";

type InputProps = React.ComponentProps<"input"> & {
  validationType?: "name" | "email" | "phone" | "code" | "slug";
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, validationType, onChange, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [validationMessage, setValidationMessage] = React.useState("");
    const isPasswordField = type === "password";
    const resolvedType = isPasswordField && showPassword ? "text" : type;
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!validationType) {
        onChange?.(event);
        return;
      }

      const rawValue = event.target.value;
      let nextValue = rawValue;
      let nextMessage = "";

      if (validationType === "name") {
        nextValue = sanitizeNameInput(rawValue);
        if (rawValue !== nextValue) nextMessage = "Only letters and spaces are allowed";
      } else if (validationType === "email") {
        nextValue = sanitizeEmailInput(rawValue);
        if (rawValue !== nextValue) nextMessage = "Email cannot contain spaces and will be lowercase";
      } else if (validationType === "phone") {
        nextValue = sanitizePhoneInput(rawValue);
        if (rawValue !== nextValue) nextMessage = "Only digits are allowed";
      } else if (validationType === "code") {
        nextValue = sanitizeCodeInput(rawValue);
        if (rawValue !== nextValue) nextMessage = "Only A-Z, 0-9, _ and - are allowed";
      } else if (validationType === "slug") {
        nextValue = sanitizeSlugInput(rawValue);
        if (rawValue !== nextValue) nextMessage = "Only lowercase letters, numbers and _ are allowed";
      }

      setValidationMessage(nextMessage);
      if (nextValue !== rawValue) {
        event.target.value = nextValue;
      }

      onChange?.(event);
    };

    if (!isPasswordField) {
      if (!validationType) {
        return (
          <input
            type={resolvedType}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className,
            )}
            ref={ref}
            onChange={handleChange}
            {...props}
          />
        );
      }
      return (
        <div className="w-full">
          <input
            type={resolvedType}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className,
            )}
            ref={ref}
            onChange={handleChange}
            {...props}
          />
          {validationType && validationMessage ? (
            <p className="mt-1 text-xs text-red-600">{validationMessage}</p>
          ) : null}
        </div>
      );
    }

    if (!validationType) {
      return (
        <div className="relative">
          <input
            type={resolvedType}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className,
            )}
            ref={ref}
            onChange={handleChange}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      );
    }

    return (
      <div className="w-full">
        <div className="relative">
          <input
            type={resolvedType}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className,
            )}
            ref={ref}
            onChange={handleChange}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {validationType && validationMessage ? (
          <p className="mt-1 text-xs text-red-600">{validationMessage}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
