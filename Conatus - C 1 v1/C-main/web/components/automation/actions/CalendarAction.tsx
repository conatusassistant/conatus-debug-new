'use client';

import { useState } from 'react';
import { Check, Calendar, Users, Bell, Clock, X } from 'lucide-react';

interface CalendarActionProps {
  value: CalendarActionConfig;
  onChange: (value: CalendarActionConfig) => void;
  onValidate: (isValid: boolean) => void;
}

export interface CalendarActionConfig {
  eventType: 'meeting' | 'appointment' | 'reminder';
  title: string;
  description?: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  location?: string;
  isAllDay: boolean;
  isRecurring: boolean;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endAfterOccurrences?: number;
    endDate?: string;
  };
  attendees: {
    email: string;
    name?: string;
    required: boolean;
  }[];
  reminders: {
    time: number;
    unit: 'minutes' | 'hours' | 'days';
  }[];
  calendarId?: string;
}

const defaultConfig: CalendarActionConfig = {
  eventType: 'meeting',
  title: '',
  description: '',
  startDate: '',
  startTime: '',
  isAllDay: false,
  isRecurring: false,
  attendees: [],
  reminders: [{ time: 15, unit: 'minutes' }],
};

export default function CalendarAction({ value, onChange, onValidate }: CalendarActionProps) {
  // Initialize with current value or default config
  const [config, setConfig] = useState<CalendarActionConfig>(value || defaultConfig);
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('');
  const [newAttendeeName, setNewAttendeeName] = useState('');
  
  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Handle input changes
  const handleChange = (field: keyof CalendarActionConfig, value: any) => {
    const updatedConfig = { ...config, [field]: value };
    setConfig(updatedConfig);
    onChange(updatedConfig);
    validateForm(updatedConfig);
  };
  
  // Handle nested property changes
  const handleNestedChange = (parent: keyof CalendarActionConfig, field: string, value: any) => {
    if (!config[parent]) return;
    
    const updatedNestedObj = { 
      ...config[parent] as Record<string, any>, 
      [field]: value 
    };
    
    const updatedConfig = { 
      ...config, 
      [parent]: updatedNestedObj 
    };
    
    setConfig(updatedConfig);
    onChange(updatedConfig);
    validateForm(updatedConfig);
  };
  
  // Add a new attendee
  const addAttendee = () => {
    if (!newAttendeeEmail.trim()) {
      setErrors({ ...errors, attendee: 'Email is required' });
      return;
    }
    
    if (!isValidEmail(newAttendeeEmail)) {
      setErrors({ ...errors, attendee: 'Invalid email format' });
      return;
    }
    
    const newAttendee = {
      email: newAttendeeEmail,
      name: newAttendeeName || undefined,
      required: true,
    };
    
    const updatedAttendees = [...config.attendees, newAttendee];
    const updatedConfig = { ...config, attendees: updatedAttendees };
    
    setConfig(updatedConfig);
    onChange(updatedConfig);
    validateForm(updatedConfig);
    
    // Reset input fields and error
    setNewAttendeeEmail('');
    setNewAttendeeName('');
    setErrors({ ...errors, attendee: '' });
  };
  
  // Remove an attendee
  const removeAttendee = (index: number) => {
    const updatedAttendees = [...config.attendees];
    updatedAttendees.splice(index, 1);
    
    const updatedConfig = { ...config, attendees: updatedAttendees };
    setConfig(updatedConfig);
    onChange(updatedConfig);
    validateForm(updatedConfig);
  };
  
  // Add a reminder
  const addReminder = () => {
    const newReminder = { time: 15, unit: 'minutes' as const };
    const updatedReminders = [...config.reminders, newReminder];
    
    const updatedConfig = { ...config, reminders: updatedReminders };
    setConfig(updatedConfig);
    onChange(updatedConfig);
    validateForm(updatedConfig);
  };
  
  // Remove a reminder
  const removeReminder = (index: number) => {
    const updatedReminders = [...config.reminders];
    updatedReminders.splice(index, 1);
    
    const updatedConfig = { ...config, reminders: updatedReminders };
    setConfig(updatedConfig);
    onChange(updatedConfig);
    validateForm(updatedConfig);
  };
  
  // Update a reminder
  const updateReminder = (index: number, field: 'time' | 'unit', value: any) => {
    const updatedReminders = [...config.reminders];
    updatedReminders[index] = { 
      ...updatedReminders[index], 
      [field]: field === 'time' ? parseInt(value, 10) : value 
    };
    
    const updatedConfig = { ...config, reminders: updatedReminders };
    setConfig(updatedConfig);
    onChange(updatedConfig);
    validateForm(updatedConfig);
  };
  
  // Toggle optional fields
  const toggleRecurring = () => {
    const isRecurring = !config.isRecurring;
    let updatedConfig = { ...config, isRecurring };
    
    // Add default recurrence config if enabling
    if (isRecurring && !config.recurrence) {
      updatedConfig.recurrence = {
        frequency: 'weekly',
        interval: 1,
      };
    }
    
    setConfig(updatedConfig);
    onChange(updatedConfig);
    validateForm(updatedConfig);
  };
  
  const toggleAllDay = () => {
    const isAllDay = !config.isAllDay;
    const updatedConfig = { ...config, isAllDay };
    
    // Clear time fields if all day is selected
    if (isAllDay) {
      updatedConfig.startTime = '';
      updatedConfig.endTime = '';
    } else {
      // Set default times if enabling time selection
      updatedConfig.startTime = '09:00';
      updatedConfig.endTime = '10:00';
    }
    
    setConfig(updatedConfig);
    onChange(updatedConfig);
    validateForm(updatedConfig);
  };
  
  // Form validation
  const validateForm = (data: CalendarActionConfig) => {
    const newErrors: Record<string, string> = {};
    
    if (!data.title) {
      newErrors.title = 'Title is required';
    }
    
    if (!data.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    
    if (!data.isAllDay && !data.startTime) {
      newErrors.startTime = 'Start time is required when not an all-day event';
    }
    
    if (data.endDate && data.startDate && new Date(data.endDate) < new Date(data.startDate)) {
      newErrors.endDate = 'End date cannot be before start date';
    }
    
    if (data.isRecurring && data.recurrence) {
      if (data.recurrence.interval <= 0) {
        newErrors.recurrenceInterval = 'Interval must be greater than 0';
      }
      
      if (
        data.recurrence.endAfterOccurrences && 
        data.recurrence.endAfterOccurrences <= 0
      ) {
        newErrors.recurrenceEndAfter = 'Number of occurrences must be greater than 0';
      }
      
      if (
        data.recurrence.endDate && 
        data.startDate && 
        new Date(data.recurrence.endDate) < new Date(data.startDate)
      ) {
        newErrors.recurrenceEndDate = 'Recurrence end date cannot be before event start date';
      }
    }
    
    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    onValidate(isValid);
    
    return isValid;
  };
  
  // Helper functions
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  // Get today's date in YYYY-MM-DD format for min attribute
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };
  
  return (
    <div className="space-y-6 p-4 bg-white rounded-lg shadow">
      <div className="flex items-center space-x-2">
        <Calendar className="h-5 w-5 text-blue-500" />
        <h2 className="text-xl font-semibold">Calendar Event Configuration</h2>
      </div>
      
      {/* Event Type Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Event Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {['meeting', 'appointment', 'reminder'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleChange('eventType', type)}
              className={`py-2 px-4 rounded-md border ${
                config.eventType === type
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Event Title */}
      <div className="space-y-1">
        <label htmlFor="event-title" className="block text-sm font-medium text-gray-700">
          Title*
        </label>
        <input
          id="event-title"
          type="text"
          value={config.title}
          onChange={(e) => handleChange('title', e.target.value)}
          className={`mt-1 block w-full rounded-md shadow-sm border ${
            errors.title ? 'border-red-500' : 'border-gray-300'
          } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
          placeholder="Event title"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title}</p>
        )}
      </div>
      
      {/* Event Description */}
      <div className="space-y-1">
        <label htmlFor="event-description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="event-description"
          value={config.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md shadow-sm border border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          placeholder="Event description"
        />
      </div>
      
      {/* Event Location */}
      <div className="space-y-1">
        <label htmlFor="event-location" className="block text-sm font-medium text-gray-700">
          Location
        </label>
        <input
          id="event-location"
          type="text"
          value={config.location || ''}
          onChange={(e) => handleChange('location', e.target.value)}
          className="mt-1 block w-full rounded-md shadow-sm border border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          placeholder="Event location"
        />
      </div>
      
      {/* All Day Toggle */}
      <div className="flex items-center space-x-2">
        <input
          id="all-day"
          type="checkbox"
          checked={config.isAllDay}
          onChange={toggleAllDay}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="all-day" className="text-sm font-medium text-gray-700">
          All day event
        </label>
      </div>
      
      {/* Date & Time Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
            Start Date*
          </label>
          <input
            id="start-date"
            type="date"
            value={config.startDate}
            min={getTodayString()}
            onChange={(e) => handleChange('startDate', e.target.value)}
            className={`mt-1 block w-full rounded-md shadow-sm border ${
              errors.startDate ? 'border-red-500' : 'border-gray-300'
            } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
          />
          {errors.startDate && (
            <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
          )}
        </div>
        
        {!config.isAllDay && (
          <div className="space-y-1">
            <label htmlFor="start-time" className="block text-sm font-medium text-gray-700">
              Start Time*
            </label>
            <input
              id="start-time"
              type="time"
              value={config.startTime}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className={`mt-1 block w-full rounded-md shadow-sm border ${
                errors.startTime ? 'border-red-500' : 'border-gray-300'
              } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
            />
            {errors.startTime && (
              <p className="mt-1 text-sm text-red-600">{errors.startTime}</p>
            )}
          </div>
        )}
        
        <div className="space-y-1">
          <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">
            End Date
          </label>
          <input
            id="end-date"
            type="date"
            value={config.endDate || ''}
            min={config.startDate || getTodayString()}
            onChange={(e) => handleChange('endDate', e.target.value)}
            className={`mt-1 block w-full rounded-md shadow-sm border ${
              errors.endDate ? 'border-red-500' : 'border-gray-300'
            } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
          />
          {errors.endDate && (
            <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
          )}
        </div>
        
        {!config.isAllDay && (
          <div className="space-y-1">
            <label htmlFor="end-time" className="block text-sm font-medium text-gray-700">
              End Time
            </label>
            <input
              id="end-time"
              type="time"
              value={config.endTime || ''}
              onChange={(e) => handleChange('endTime', e.target.value)}
              className="mt-1 block w-full rounded-md shadow-sm border border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
          </div>
        )}
      </div>
      
      {/* Recurrence Settings */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <input
            id="is-recurring"
            type="checkbox"
            checked={config.isRecurring}
            onChange={toggleRecurring}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="is-recurring" className="text-sm font-medium text-gray-700">
            Recurring event
          </label>
        </div>
        
        {config.isRecurring && config.recurrence && (
          <div className="pl-6 space-y-4 border-l-2 border-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="recurrence-frequency" className="block text-sm font-medium text-gray-700">
                  Frequency
                </label>
                <select
                  id="recurrence-frequency"
                  value={config.recurrence.frequency}
                  onChange={(e) => handleNestedChange('recurrence', 'frequency', e.target.value)}
                  className="mt-1 block w-full rounded-md shadow-sm border border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label htmlFor="recurrence-interval" className="block text-sm font-medium text-gray-700">
                  Every
                </label>
                <div className="flex items-center">
                  <input
                    id="recurrence-interval"
                    type="number"
                    min="1"
                    value={config.recurrence.interval}
                    onChange={(e) => handleNestedChange(
                      'recurrence',
                      'interval',
                      parseInt(e.target.value, 10) || 1
                    )}
                    className={`mt-1 block w-full rounded-md shadow-sm border ${
                      errors.recurrenceInterval ? 'border-red-500' : 'border-gray-300'
                    } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
                  />
                  <span className="ml-2 text-sm text-gray-500">
                    {config.recurrence.frequency === 'daily' && 'day(s)'}
                    {config.recurrence.frequency === 'weekly' && 'week(s)'}
                    {config.recurrence.frequency === 'monthly' && 'month(s)'}
                    {config.recurrence.frequency === 'yearly' && 'year(s)'}
                  </span>
                </div>
                {errors.recurrenceInterval && (
                  <p className="mt-1 text-sm text-red-600">{errors.recurrenceInterval}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">End recurrence</h4>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    id="end-after-occurrences"
                    type="radio"
                    name="recurrence-end"
                    checked={config.recurrence.endAfterOccurrences !== undefined}
                    onChange={() => handleNestedChange('recurrence', 'endAfterOccurrences', 1)}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="end-after-occurrences" className="text-sm text-gray-700">
                    After
                  </label>
                  {config.recurrence.endAfterOccurrences !== undefined && (
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="1"
                        value={config.recurrence.endAfterOccurrences}
                        onChange={(e) => handleNestedChange(
                          'recurrence',
                          'endAfterOccurrences',
                          parseInt(e.target.value, 10) || 1
                        )}
                        className={`w-16 rounded-md shadow-sm border ${
                          errors.recurrenceEndAfter ? 'border-red-500' : 'border-gray-300'
                        } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
                      />
                      <span className="ml-2 text-sm text-gray-500">occurrence(s)</span>
                    </div>
                  )}
                </div>
                {errors.recurrenceEndAfter && (
                  <p className="mt-1 text-sm text-red-600">{errors.recurrenceEndAfter}</p>
                )}
                
                <div className="flex items-center space-x-2">
                  <input
                    id="end-by-date"
                    type="radio"
                    name="recurrence-end"
                    checked={config.recurrence.endDate !== undefined}
                    onChange={() => {
                      // Remove endAfterOccurrences and add endDate
                      const { endAfterOccurrences, ...restRecurrence } = config.recurrence;
                      handleChange('recurrence', {
                        ...restRecurrence,
                        endDate: getTodayString()
                      });
                    }}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="end-by-date" className="text-sm text-gray-700">
                    On date
                  </label>
                  {config.recurrence.endDate !== undefined && (
                    <input
                      type="date"
                      min={config.startDate || getTodayString()}
                      value={config.recurrence.endDate}
                      onChange={(e) => handleNestedChange('recurrence', 'endDate', e.target.value)}
                      className={`ml-2 rounded-md shadow-sm border ${
                        errors.recurrenceEndDate ? 'border-red-500' : 'border-gray-300'
                      } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
                    />
                  )}
                </div>
                {errors.recurrenceEndDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.recurrenceEndDate}</p>
                )}
                
                <div className="flex items-center space-x-2">
                  <input
                    id="no-end"
                    type="radio"
                    name="recurrence-end"
                    checked={
                      config.recurrence.endAfterOccurrences === undefined && 
                      config.recurrence.endDate === undefined
                    }
                    onChange={() => {
                      // Remove both end conditions
                      const { endAfterOccurrences, endDate, ...restRecurrence } = config.recurrence;
                      handleChange('recurrence', restRecurrence);
                    }}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="no-end" className="text-sm text-gray-700">
                    Never
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Attendees */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-medium text-gray-700 flex items-center">
            <Users className="mr-2 h-5 w-5 text-blue-500" />
            Attendees
          </h3>
        </div>
        
        <div className="space-y-4">
          {/* Add new attendee form */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="sm:flex-1">
              <input
                type="email"
                value={newAttendeeEmail}
                onChange={(e) => setNewAttendeeEmail(e.target.value)}
                placeholder="Email*"
                className={`w-full rounded-md shadow-sm border ${
                  errors.attendee ? 'border-red-500' : 'border-gray-300'
                } focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50`}
              />
            </div>
            <div className="sm:flex-1">
              <input
                type="text"
                value={newAttendeeName}
                onChange={(e) => setNewAttendeeName(e.target.value)}
                placeholder="Name (optional)"
                className="w-full rounded-md shadow-sm border border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={addAttendee}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Add
            </button>
          </div>
          {errors.attendee && (
            <p className="mt-1 text-sm text-red-600">{errors.attendee}</p>
          )}
          
          {/* Attendees list */}
          {config.attendees.length > 0 ? (
            <ul className="divide-y divide-gray-200 border rounded-md">
              {config.attendees.map((attendee, index) => (
                <li key={index} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{attendee.email}</p>
                    {attendee.name && <p className="text-sm text-gray-500">{attendee.name}</p>}
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={attendee.required}
                        onChange={(e) => {
                          const updatedAttendees = [...config.attendees];
                          updatedAttendees[index] = {
                            ...attendee,
                            required: e.target.checked
                          };
                          handleChange('attendees', updatedAttendees);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-500">Required</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeAttendee(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 italic">No attendees added</p>
          )}
        </div>
      </div>
      
      {/* Reminders */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-medium text-gray-700 flex items-center">
            <Bell className="mr-2 h-5 w-5 text-blue-500" />
            Reminders
          </h3>
          <button
            type="button"
            onClick={addReminder}
            className="text-sm text-blue-500 hover:text-blue-700"
          >
            + Add reminder
          </button>
        </div>
        
        {config.reminders.length > 0 ? (
          <ul className="space-y-2">
            {config.reminders.map((reminder, index) => (
              <li key={index} className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-gray-400" />
                <select
                  value={reminder.time}
                  onChange={(e) => updateReminder(index, 'time', e.target.value)}
                  className="rounded-md shadow-sm border border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                >
                  {[5, 10, 15, 30, 45, 60, 120, 180, 1440, 2880].map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
                <select
                  value={reminder.unit}
                  onChange={(e) => updateReminder(index, 'unit', e.target.value)}
                  className="rounded-md shadow-sm border border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                >
                  <option value="minutes">minutes before</option>
                  <option value="hours">hours before</option>
                  <option value="days">days before</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeReminder(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">No reminders set</p>
        )}
      </div>
      
      {/* Calendar Selection - Only displayed if user has connected multiple calendars */}
      <div className="space-y-2">
        <label htmlFor="calendar-id" className="block text-sm font-medium text-gray-700">
          Calendar
        </label>
        <select
          id="calendar-id"
          value={config.calendarId || ''}
          onChange={(e) => handleChange('calendarId', e.target.value)}
          className="mt-1 block w-full rounded-md shadow-sm border border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
        >
          <option value="">Default calendar</option>
          <option value="work">Work calendar</option>
          <option value="personal">Personal calendar</option>
          <option value="family">Family calendar</option>
        </select>
      </div>
    </div>
  );
}
