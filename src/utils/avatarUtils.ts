/**
 * Utility functions for generating initials-based avatars
 */

export function getInitials(name: string, email: string): string {
  // If we have a name, use the first letter of the first two words
  if (name && name.trim() && name !== 'User' && name !== 'undefined') {
    const nameParts = name.trim().split(' ').filter(part => part.length > 0);
    if (nameParts.length >= 2) {
      return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
    } else if (nameParts.length === 1) {
      return nameParts[0].charAt(0).toUpperCase();
    }
  }
  
  // Fallback to email first letter
  if (email && email.includes('@')) {
    return email.charAt(0).toUpperCase();
  }
  
  return 'U'; // Ultimate fallback
}

export function getInitialsColor(name: string, email: string): string {
  // Generate a consistent color based on the name/email
  const identifier = name && name !== 'User' && name !== 'undefined' ? name : email;
  const colors = [
    'bg-indigo-600',
    'bg-blue-600',
    'bg-green-600',
    'bg-amber-600',
    'bg-red-600',
    'bg-purple-600',
    'bg-pink-600',
    'bg-teal-600',
    'bg-orange-600',
    'bg-cyan-600'
  ];
  
  // Simple hash function to get consistent color
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

interface InitialsAvatarProps {
  name: string;
  email: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function getInitialsAvatarClasses(size: 'sm' | 'md' | 'lg' | 'xl' = 'md'): string {
  const sizeClasses = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg'
  };
  
  return `${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-medium`;
}

export function InitialsAvatar({ name, email, size = 'md', className = '' }: InitialsAvatarProps) {
  const initials = getInitials(name, email);
  const colorClass = getInitialsColor(name, email);
  const sizeClasses = getInitialsAvatarClasses(size);
  
  return {
    initials,
    colorClass,
    className: `${sizeClasses} ${colorClass} ${className}`
  };
}