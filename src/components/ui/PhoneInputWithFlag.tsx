import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

interface PhoneInputWithFlagProps {
  value: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const PhoneInputWithFlag = ({
  value,
  onChange,
  disabled,
  placeholder = "Enter phone number",
  className,
}: PhoneInputWithFlagProps) => {
  return (
    <PhoneInput
      international
      defaultCountry="IN"
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(
        "phone-input-custom flex w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    />
  );
};
